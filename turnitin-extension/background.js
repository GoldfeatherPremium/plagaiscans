// Plagaiscans Turnitin Automation - Background Service Worker
// This runs persistently and polls for pending documents

const SUPABASE_URL = 'https://fyssbzgmhnolazjfwafm.supabase.co';
const EXTENSION_API_URL = `${SUPABASE_URL}/functions/v1/extension-api`;
const POLL_INTERVAL_MS = 10000; // 10 seconds
const MAX_PROCESSING_TIME_MS = 30 * 60 * 1000; // 30 minutes max per document

let isProcessing = false;
let currentDocumentId = null;
let isEnabled = true;
let extensionToken = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Plagaiscans Turnitin Automation installed');
  chrome.storage.local.set({ 
    isEnabled: true,
    processedCount: 0,
    lastError: null,
    currentStatus: 'idle'
  });
  
  // Set up polling alarm
  chrome.alarms.create('pollDocuments', { periodInMinutes: 0.17 }); // ~10 seconds
});

// Handle alarm for polling
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pollDocuments') {
    await checkForPendingDocuments();
  }
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'GET_STATUS':
      const status = await getStatus();
      sendResponse(status);
      break;
      
    case 'TOGGLE_ENABLED':
      isEnabled = message.enabled;
      chrome.storage.local.set({ isEnabled });
      sendResponse({ success: true, isEnabled });
      break;
      
    case 'GET_CURRENT_DOCUMENT':
      sendResponse({ documentId: currentDocumentId });
      break;
      
    case 'TURNITIN_READY':
      // Content script reports Turnitin page is ready
      console.log('Turnitin page ready, starting automation');
      sendResponse({ acknowledged: true });
      break;
      
    case 'UPLOAD_COMPLETE':
      // Content script reports upload is complete
      await handleUploadComplete(message.data);
      sendResponse({ success: true });
      break;
      
    case 'REPORTS_READY':
      // Content script has downloaded the reports
      await handleReportsReady(message.data);
      sendResponse({ success: true });
      break;
      
    case 'AUTOMATION_ERROR':
      await handleAutomationError(message.error);
      sendResponse({ acknowledged: true });
      break;
      
    case 'REQUEST_FILE':
      // Content script needs the file to upload
      const fileData = await getFileForUpload();
      sendResponse(fileData);
      break;
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
}

async function getStatus() {
  const data = await chrome.storage.local.get([
    'isEnabled', 
    'processedCount', 
    'lastError', 
    'currentStatus',
    'currentDocumentName',
    'turnitinCredentials',
    'extensionToken'
  ]);
  
  return {
    isEnabled: data.isEnabled ?? true,
    isProcessing,
    currentDocumentId,
    currentDocumentName: data.currentDocumentName,
    processedCount: data.processedCount ?? 0,
    lastError: data.lastError,
    currentStatus: data.currentStatus ?? 'idle',
    hasCredentials: !!data.turnitinCredentials?.email,
    hasToken: !!data.extensionToken
  };
}

async function getExtensionToken() {
  if (extensionToken) return extensionToken;
  
  const data = await chrome.storage.local.get(['extensionToken']);
  extensionToken = data.extensionToken;
  return extensionToken;
}

async function apiRequest(action, payload = {}) {
  const token = await getExtensionToken();
  if (!token) {
    throw new Error('Extension token not configured');
  }
  
  const response = await fetch(EXTENSION_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-extension-token': token
    },
    body: JSON.stringify({ action, ...payload })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }
  
  return response.json();
}

async function checkForPendingDocuments() {
  if (!isEnabled || isProcessing) {
    return;
  }
  
  try {
    const token = await getExtensionToken();
    if (!token) {
      console.log('No extension token configured, skipping poll');
      return;
    }
    
    // Check for credentials
    const creds = await chrome.storage.local.get(['turnitinCredentials']);
    if (!creds.turnitinCredentials?.email) {
      console.log('No Turnitin credentials configured, skipping poll');
      return;
    }
    
    // Send heartbeat and get pending documents
    const result = await apiRequest('get_pending_documents');
    
    if (result.documents && result.documents.length > 0) {
      await processDocument(result.documents[0]);
    }
  } catch (error) {
    console.error('Error checking for pending documents:', error);
    await logError('poll_error', error.message);
  }
}

async function processDocument(document) {
  if (isProcessing) return;
  
  isProcessing = true;
  currentDocumentId = document.id;
  
  try {
    console.log(`Processing document: ${document.file_name}`);
    
    await chrome.storage.local.set({ 
      currentStatus: 'processing',
      currentDocumentName: document.file_name
    });
    
    // Update document status to processing
    await apiRequest('update_document_status', {
      documentId: document.id,
      automationStatus: 'processing'
    });
    
    // Increment attempt count
    await apiRequest('increment_attempt_count', {
      documentId: document.id
    });
    
    // Log the start
    await apiRequest('log_automation', {
      documentId: document.id,
      logAction: 'processing_started',
      message: 'Started processing document'
    });
    
    // Download the file from storage
    await chrome.storage.local.set({ currentStatus: 'downloading' });
    const fileData = await downloadFile(document.file_path);
    
    // Store file data for content script to access
    await chrome.storage.local.set({ 
      currentFileData: fileData,
      currentFileName: document.file_name,
      currentFilePath: document.file_path,
      currentScanType: document.scan_type
    });
    
    // Open Turnitin in a new tab
    await chrome.storage.local.set({ currentStatus: 'opening_turnitin' });
    const tab = await chrome.tabs.create({ 
      url: 'https://www.turnitin.com/login_page.asp',
      active: false // Keep it in background
    });
    
    // Store tab ID for cleanup
    await chrome.storage.local.set({ turnitinTabId: tab.id });
    
    // The content script will take over from here
    
  } catch (error) {
    console.error('Error processing document:', error);
    await handleAutomationError(error.message);
  }
}

async function downloadFile(filePath) {
  // Get signed URL from our API
  const result = await apiRequest('get_signed_url', {
    bucketName: 'documents',
    filePath: filePath
  });
  
  if (!result.signedUrl) {
    throw new Error('Failed to get signed URL');
  }
  
  // Download the file
  const fileResponse = await fetch(result.signedUrl);
  if (!fileResponse.ok) {
    throw new Error('Failed to download file');
  }
  
  const blob = await fileResponse.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  
  return {
    base64,
    mimeType: blob.type,
    size: blob.size
  };
}

async function getFileForUpload() {
  const data = await chrome.storage.local.get([
    'currentFileData',
    'currentFileName'
  ]);
  
  return {
    fileData: data.currentFileData,
    fileName: data.currentFileName
  };
}

async function handleUploadComplete(data) {
  console.log('Upload complete, waiting for processing', data);
  
  await chrome.storage.local.set({ 
    currentStatus: 'waiting_for_results',
    turnitinSubmissionId: data.submissionId
  });
  
  await apiRequest('log_automation', {
    documentId: currentDocumentId,
    logAction: 'upload_complete',
    message: `Document uploaded to Turnitin. Submission ID: ${data.submissionId}`
  });
}

async function handleReportsReady(data) {
  console.log('Reports ready, uploading to storage', data);
  
  try {
    await chrome.storage.local.set({ currentStatus: 'uploading_reports' });
    
    // Upload similarity report
    if (data.similarityReport) {
      const similarityPath = `${currentDocumentId}/similarity_report.pdf`;
      await apiRequest('upload_report', {
        fileData: data.similarityReport,
        fileName: 'similarity_report.pdf',
        bucketName: 'reports',
        filePath: similarityPath
      });
    }
    
    // Upload AI report if available
    if (data.aiReport) {
      const aiPath = `${currentDocumentId}/ai_report.pdf`;
      await apiRequest('upload_report', {
        fileData: data.aiReport,
        fileName: 'ai_report.pdf',
        bucketName: 'reports',
        filePath: aiPath
      });
    }
    
    // Mark document as completed
    await apiRequest('complete_document', {
      documentId: currentDocumentId,
      similarityPercentage: data.similarityPercentage,
      aiPercentage: data.aiPercentage,
      similarityReportPath: data.similarityReport ? `${currentDocumentId}/similarity_report.pdf` : null,
      aiReportPath: data.aiReport ? `${currentDocumentId}/ai_report.pdf` : null
    });
    
    await apiRequest('log_automation', {
      documentId: currentDocumentId,
      logAction: 'processing_complete',
      message: `Document processed. Similarity: ${data.similarityPercentage}%, AI: ${data.aiPercentage || 'N/A'}%`
    });
    
    // Update processed count
    const storage = await chrome.storage.local.get(['processedCount']);
    await chrome.storage.local.set({ 
      processedCount: (storage.processedCount || 0) + 1,
      currentStatus: 'idle',
      lastProcessedAt: new Date().toISOString()
    });
    
    // Close Turnitin tab
    const { turnitinTabId } = await chrome.storage.local.get(['turnitinTabId']);
    if (turnitinTabId) {
      try {
        await chrome.tabs.remove(turnitinTabId);
      } catch (e) {
        // Tab might already be closed
      }
    }
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Document Processed',
      message: `${data.fileName || 'Document'} has been processed successfully`
    });
    
    // Reset state
    isProcessing = false;
    currentDocumentId = null;
    
    // Clean up stored data
    await chrome.storage.local.remove([
      'currentFileData',
      'currentFileName', 
      'currentFilePath',
      'currentScanType',
      'turnitinTabId',
      'turnitinSubmissionId'
    ]);
    
  } catch (error) {
    console.error('Error handling reports:', error);
    await handleAutomationError(error.message);
  }
}

async function handleAutomationError(errorMessage) {
  console.error('Automation error:', errorMessage);
  
  if (currentDocumentId) {
    try {
      // Update document with error
      await apiRequest('update_document_status', {
        documentId: currentDocumentId,
        automationStatus: 'failed',
        errorMessage: errorMessage
      });
      
      await apiRequest('log_automation', {
        documentId: currentDocumentId,
        logAction: 'processing_failed',
        message: errorMessage
      });
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }
  
  await chrome.storage.local.set({ 
    currentStatus: 'error',
    lastError: errorMessage,
    lastErrorAt: new Date().toISOString()
  });
  
  // Show error notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Automation Error',
    message: errorMessage.substring(0, 100)
  });
  
  // Reset state
  isProcessing = false;
  currentDocumentId = null;
  
  // Clean up
  const { turnitinTabId } = await chrome.storage.local.get(['turnitinTabId']);
  if (turnitinTabId) {
    try {
      await chrome.tabs.remove(turnitinTabId);
    } catch (e) {}
  }
  
  await chrome.storage.local.remove([
    'currentFileData',
    'currentFileName',
    'currentFilePath', 
    'currentScanType',
    'turnitinTabId',
    'turnitinSubmissionId'
  ]);
}

async function logError(action, message) {
  await chrome.storage.local.set({ lastError: message });
}

// Start checking for documents immediately
checkForPendingDocuments();
