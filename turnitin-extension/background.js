// Plagaiscans Turnitin Automation - Background Script (MV2)
// This runs persistently and polls for pending documents

var SUPABASE_URL = 'https://fyssbzgmhnolazjfwafm.supabase.co';
var EXTENSION_API_URL = SUPABASE_URL + '/functions/v1/extension-api';
var DEFAULT_POLL_INTERVAL_MS = 10000; // 10 seconds
var MAX_PROCESSING_TIME_MS = 30 * 60 * 1000; // 30 minutes max per document

var isProcessing = false;
var currentDocumentId = null;
var isEnabled = true;
var extensionToken = null;

// Initialize alarm immediately on script load (for Kiwi Browser compatibility)
// Note: Minimum alarm period is 1 minute in released extensions
chrome.alarms.get('pollDocuments', function(alarm) {
  if (!alarm) {
    chrome.alarms.create('pollDocuments', { periodInMinutes: 1 }); // 1 minute minimum
    console.log('Created pollDocuments alarm on script load');
  }
});

// Initialize extension on install
chrome.runtime.onInstalled.addListener(function() {
  console.log('Plagaiscans Turnitin Automation installed');
  chrome.storage.local.set({ 
    isEnabled: true,
    processedCount: 0,
    lastError: null,
    currentStatus: 'idle'
  });
  
  // Set up polling alarm (minimum 1 minute in released extensions)
  chrome.alarms.create('pollDocuments', { periodInMinutes: 1 });
});

// Also create alarm on browser startup (for Kiwi Browser)
chrome.runtime.onStartup.addListener(function() {
  console.log('Extension started on browser startup');
  chrome.alarms.create('pollDocuments', { periodInMinutes: 1 });
});

// Handle alarm for polling
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === 'pollDocuments') {
    checkForPendingDocuments();
  }
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

function handleMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'GET_STATUS':
      getStatus().then(function(status) {
        sendResponse(status);
      });
      break;
      
    case 'TOGGLE_ENABLED':
      isEnabled = message.enabled;
      chrome.storage.local.set({ isEnabled: isEnabled });
      sendResponse({ success: true, isEnabled: isEnabled });
      break;
      
    case 'GET_CURRENT_DOCUMENT':
      sendResponse({ documentId: currentDocumentId });
      break;
      
    case 'TURNITIN_READY':
      console.log('Turnitin page ready, starting automation');
      sendResponse({ acknowledged: true });
      break;
      
    case 'UPLOAD_COMPLETE':
      handleUploadComplete(message.data).then(function() {
        sendResponse({ success: true });
      });
      break;
      
    case 'REPORTS_READY':
      handleReportsReady(message.data).then(function() {
        sendResponse({ success: true });
      });
      break;
      
    case 'AUTOMATION_ERROR':
      handleAutomationError(message.error).then(function() {
        sendResponse({ acknowledged: true });
      });
      break;
      
    case 'REQUEST_FILE':
      getFileForUpload().then(function(fileData) {
        sendResponse(fileData);
      });
      break;
      
    case 'GET_TURNITIN_SETTINGS':
      getTurnitinSettings().then(function(settings) {
        sendResponse(settings);
      });
      break;
      
    case 'START_PROCESSING_NOW':
      startProcessingNow().then(function(result) {
        sendResponse(result);
      });
      break;
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
}

function getStatus() {
  return new Promise(function(resolve) {
    chrome.storage.local.get([
      'isEnabled', 
      'processedCount', 
      'lastError', 
      'currentStatus',
      'currentDocumentName',
      'turnitinCredentials',
      'extensionToken',
      'turnitinSettings',
      'authMethod',
      'turnitinCookies'
    ], function(data) {
      resolve({
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
        isProcessing: isProcessing,
        currentDocumentId: currentDocumentId,
        currentDocumentName: data.currentDocumentName,
        processedCount: data.processedCount || 0,
        lastError: data.lastError,
        currentStatus: data.currentStatus || 'idle',
        hasCredentials: !!(data.turnitinCredentials && data.turnitinCredentials.username),
        hasCookies: !!(data.turnitinCookies && data.turnitinCookies.length > 0),
        authMethod: data.authMethod || 'credentials',
        hasToken: !!data.extensionToken,
        turnitinSettings: data.turnitinSettings || null
      });
    });
  });
}

function getTurnitinSettings() {
  return new Promise(function(resolve) {
    chrome.storage.local.get(['turnitinSettings'], function(data) {
      resolve(data.turnitinSettings || {
        loginUrl: 'https://nrtiedu.turnitin.com/',
        folderName: 'Bio 2',
        autoLaunch: true,
        waitForAiReport: true
      });
    });
  });
}

function getExtensionToken() {
  return new Promise(function(resolve) {
    if (extensionToken) {
      resolve(extensionToken);
      return;
    }
    
    chrome.storage.local.get(['extensionToken'], function(data) {
      extensionToken = data.extensionToken;
      resolve(extensionToken);
    });
  });
}

function apiRequest(action, payload) {
  payload = payload || {};
  
  return getExtensionToken().then(function(token) {
    if (!token) {
      throw new Error('Extension token not configured');
    }
    
    return fetch(EXTENSION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-extension-token': token
      },
      body: JSON.stringify(Object.assign({ action: action }, payload))
    });
  }).then(function(response) {
    if (!response.ok) {
      return response.json().catch(function() {
        return { error: 'Unknown error' };
      }).then(function(error) {
        throw new Error(error.error || 'API error: ' + response.status);
      });
    }
    return response.json();
  });
}

function startProcessingNow() {
  if (isProcessing) {
    return Promise.resolve({ success: false, message: 'Already processing' });
  }
  
  return getExtensionToken().then(function(token) {
    if (!token) {
      return { success: false, message: 'Extension token not configured' };
    }
    
    return new Promise(function(resolve) {
      chrome.storage.local.get(['turnitinCredentials', 'authMethod', 'turnitinCookies'], function(data) {
        var hasCredentials = data.turnitinCredentials && data.turnitinCredentials.username;
        var hasCookies = data.authMethod === 'cookies' && data.turnitinCookies && data.turnitinCookies.length > 0;
        
        if (!hasCredentials && !hasCookies) {
          resolve({ success: false, message: 'Turnitin authentication not configured' });
          return;
        }
        
        // Clear the lastCompletedAt to allow processing (manual trigger)
        chrome.storage.local.remove(['lastCompletedAt'], function() {
          apiRequest('get_pending_documents').then(function(result) {
            if (result.documents && result.documents.length > 0) {
              processDocument(result.documents[0]);
              resolve({ success: true, message: 'Started processing: ' + result.documents[0].file_name });
            } else {
              resolve({ success: false, message: 'No pending documents found' });
            }
          }).catch(function(error) {
            resolve({ success: false, message: error.message });
          });
        });
      });
    });
  });
}

function checkForPendingDocuments() {
  if (!isEnabled || isProcessing) {
    return;
  }
  
  getExtensionToken().then(function(token) {
    if (!token) {
      console.log('No extension token configured, skipping poll');
      return;
    }
    
    // Check for credentials OR cookies
    chrome.storage.local.get(['turnitinCredentials', 'authMethod', 'turnitinCookies', 'autoProcessNext', 'lastCompletedAt'], function(data) {
      var hasCredentials = data.turnitinCredentials && data.turnitinCredentials.username;
      var hasCookies = data.authMethod === 'cookies' && data.turnitinCookies && data.turnitinCookies.length > 0;
      
      if (!hasCredentials && !hasCookies) {
        console.log('No Turnitin authentication configured, skipping poll');
        return;
      }
      
      // Check if auto-process is disabled and we completed a document recently
      if (!data.autoProcessNext && data.lastCompletedAt) {
        console.log('Single-file mode: waiting for manual trigger. Last completed:', new Date(data.lastCompletedAt).toISOString());
        return;
      }
      
      // Send heartbeat and get pending documents
      apiRequest('get_pending_documents').then(function(result) {
        if (result.documents && result.documents.length > 0) {
          processDocument(result.documents[0]);
        }
      }).catch(function(error) {
        console.error('Error checking for pending documents:', error);
        logError('poll_error', error.message);
      });
    });
  });
}

function processDocument(document) {
  if (isProcessing) return;
  
  isProcessing = true;
  currentDocumentId = document.id;
  
  console.log('Processing document: ' + document.file_name);
  
  chrome.storage.local.set({ 
    currentStatus: 'processing',
    currentDocumentName: document.file_name
  });
  
  // Update document status to processing
  apiRequest('update_document_status', {
    documentId: document.id,
    automationStatus: 'processing'
  }).then(function() {
    return apiRequest('increment_attempt_count', {
      documentId: document.id
    });
  }).then(function() {
    return apiRequest('log_automation', {
      documentId: document.id,
      logAction: 'processing_started',
      message: 'Started processing document'
    });
  }).then(function() {
    chrome.storage.local.set({ currentStatus: 'downloading' });
    return downloadFile(document.file_path);
  }).then(function(fileData) {
    chrome.storage.local.set({ 
      currentFileData: fileData,
      currentFileName: document.file_name,
      currentFilePath: document.file_path,
      currentScanType: document.scan_type
    });
    
    return getTurnitinSettings();
  }).then(function(turnitinSettings) {
    chrome.storage.local.set({ currentStatus: 'opening_turnitin' });
    
    // Inject cookies if using cookie auth before opening tab
    return injectCookiesIfNeeded().then(function() {
      return turnitinSettings;
    });
  }).then(function(turnitinSettings) {
    // Determine URL based on auth method
    return new Promise(function(resolve) {
      chrome.storage.local.get(['authMethod'], function(data) {
        var url = turnitinSettings.loginUrl;
        
        // If using cookies, go directly to home page (skip login)
        if (data.authMethod === 'cookies') {
          url = turnitinSettings.loginUrl.replace(/\/$/, '') + '/home';
        }
        
        chrome.tabs.create({ 
          url: url,
          active: false
        }, function(tab) {
          chrome.storage.local.set({ turnitinTabId: tab.id });
          resolve();
        });
      });
    });
  }).catch(function(error) {
    console.error('Error processing document:', error);
    handleAutomationError(error.message);
  });
}

// Inject cookies for Turnitin if using cookie authentication
function injectCookiesIfNeeded() {
  return new Promise(function(resolve) {
    chrome.storage.local.get(['authMethod', 'turnitinCookies'], function(data) {
      if (data.authMethod !== 'cookies' || !data.turnitinCookies || data.turnitinCookies.length === 0) {
        resolve();
        return;
      }
      
      console.log('Injecting ' + data.turnitinCookies.length + ' cookies for Turnitin');
      
      var promises = data.turnitinCookies.map(function(cookie) {
        return new Promise(function(cookieResolve) {
          chrome.cookies.set({
            url: 'https://nrtiedu.turnitin.com',
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || '.turnitin.com',
            path: cookie.path || '/',
            secure: cookie.secure !== false,
            httpOnly: cookie.httpOnly || false,
            expirationDate: cookie.expirationDate
          }, function(result) {
            if (chrome.runtime.lastError) {
              console.log('Failed to set cookie ' + cookie.name + ':', chrome.runtime.lastError);
            }
            cookieResolve();
          });
        });
      });
      
      Promise.all(promises).then(function() {
        console.log('Cookie injection complete');
        resolve();
      });
    });
  });
}

function downloadFile(filePath) {
  return apiRequest('get_signed_url', {
    bucketName: 'documents',
    filePath: filePath
  }).then(function(result) {
    if (!result.signedUrl) {
      throw new Error('Failed to get signed URL');
    }
    
    return fetch(result.signedUrl);
  }).then(function(fileResponse) {
    if (!fileResponse.ok) {
      throw new Error('Failed to download file');
    }
    
    return fileResponse.blob();
  }).then(function(blob) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function() {
        var base64 = reader.result.split(',')[1];
        resolve({
          base64: base64,
          mimeType: blob.type,
          size: blob.size
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  });
}

function getFileForUpload() {
  return new Promise(function(resolve) {
    chrome.storage.local.get([
      'currentFileData',
      'currentFileName'
    ], function(data) {
      resolve({
        fileData: data.currentFileData,
        fileName: data.currentFileName
      });
    });
  });
}

function handleUploadComplete(data) {
  console.log('Upload complete, waiting for processing', data);
  
  chrome.storage.local.set({ 
    currentStatus: 'waiting_for_results',
    turnitinSubmissionId: data.submissionId
  });
  
  return apiRequest('log_automation', {
    documentId: currentDocumentId,
    logAction: 'upload_complete',
    message: 'Document uploaded to Turnitin. Submission ID: ' + data.submissionId
  });
}

function handleReportsReady(data) {
  console.log('Reports ready, uploading to storage', data);
  
  chrome.storage.local.set({ currentStatus: 'uploading_reports' });
  
  var promises = [];
  
  // Upload similarity report
  if (data.similarityReport) {
    var similarityPath = currentDocumentId + '/similarity_report.pdf';
    promises.push(apiRequest('upload_report', {
      fileData: data.similarityReport,
      fileName: 'similarity_report.pdf',
      bucketName: 'reports',
      filePath: similarityPath
    }));
  }
  
  // Upload AI report if available
  if (data.aiReport) {
    var aiPath = currentDocumentId + '/ai_report.pdf';
    promises.push(apiRequest('upload_report', {
      fileData: data.aiReport,
      fileName: 'ai_report.pdf',
      bucketName: 'reports',
      filePath: aiPath
    }));
  }
  
  return Promise.all(promises).then(function() {
    return apiRequest('complete_document', {
      documentId: currentDocumentId,
      similarityPercentage: data.similarityPercentage,
      aiPercentage: data.aiPercentage,
      similarityReportPath: data.similarityReport ? currentDocumentId + '/similarity_report.pdf' : null,
      aiReportPath: data.aiReport ? currentDocumentId + '/ai_report.pdf' : null
    });
  }).then(function() {
    return apiRequest('log_automation', {
      documentId: currentDocumentId,
      logAction: 'processing_complete',
      message: 'Document processed. Similarity: ' + data.similarityPercentage + '%, AI: ' + (data.aiPercentage || 'N/A') + '%'
    });
  }).then(function() {
    return new Promise(function(resolve) {
      chrome.storage.local.get(['processedCount'], function(storage) {
        chrome.storage.local.set({ 
          processedCount: (storage.processedCount || 0) + 1,
          currentStatus: 'idle',
          lastProcessedAt: new Date().toISOString()
        }, resolve);
      });
    });
  }).then(function() {
    return new Promise(function(resolve) {
      chrome.storage.local.get(['turnitinTabId'], function(result) {
        if (result.turnitinTabId) {
          try {
            chrome.tabs.remove(result.turnitinTabId);
          } catch (e) {}
        }
        resolve();
      });
    });
  }).then(function() {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Document Processed',
      message: (data.fileName || 'Document') + ' has been processed successfully'
    });
    
    isProcessing = false;
    currentDocumentId = null;
    
    // Mark completion time for single-file mode
    chrome.storage.local.set({
      lastCompletedAt: Date.now()
    });
    
    chrome.storage.local.remove([
      'currentFileData',
      'currentFileName', 
      'currentFilePath',
      'currentScanType',
      'turnitinTabId',
      'turnitinSubmissionId'
    ]);
  }).catch(function(error) {
    console.error('Error handling reports:', error);
    return handleAutomationError(error.message);
  });
}

function handleAutomationError(errorMessage) {
  console.error('Automation error:', errorMessage);
  
  var promise = Promise.resolve();
  
  if (currentDocumentId) {
    promise = apiRequest('update_document_status', {
      documentId: currentDocumentId,
      automationStatus: 'failed',
      errorMessage: errorMessage
    }).then(function() {
      return apiRequest('log_automation', {
        documentId: currentDocumentId,
        logAction: 'processing_failed',
        message: errorMessage
      });
    }).catch(function(e) {
      console.error('Failed to log error:', e);
    });
  }
  
  return promise.then(function() {
    chrome.storage.local.set({ 
      currentStatus: 'error',
      lastError: errorMessage,
      lastErrorAt: new Date().toISOString()
    });
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Automation Error',
      message: errorMessage.substring(0, 100)
    });
    
    isProcessing = false;
    currentDocumentId = null;
    
    return new Promise(function(resolve) {
      chrome.storage.local.get(['turnitinTabId'], function(result) {
        if (result.turnitinTabId) {
          try {
            chrome.tabs.remove(result.turnitinTabId);
          } catch (e) {}
        }
        
        chrome.storage.local.remove([
          'currentFileData',
          'currentFileName',
          'currentFilePath', 
          'currentScanType',
          'turnitinTabId',
          'turnitinSubmissionId'
        ], resolve);
      });
    });
  });
}

function logError(action, message) {
  chrome.storage.local.set({ lastError: message });
}

// Start checking for documents immediately
checkForPendingDocuments();
