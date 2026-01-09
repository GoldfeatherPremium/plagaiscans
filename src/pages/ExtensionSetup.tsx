import React, { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { 
  Download, 
  Copy, 
  Check, 
  Settings, 
  FileCode,
  Chrome,
  Puzzle,
  Play,
  AlertCircle
} from "lucide-react";

const ExtensionSetup: React.FC = () => {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extension-api`;

  const copyToClipboard = (text: string, fileName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(fileName);
    setTimeout(() => setCopiedFile(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  // Extension manifest.json
  const manifestJson = `{
  "manifest_version": 3,
  "name": "PlagaiScans Turnitin Automation",
  "version": "1.0.0",
  "description": "Automates similarity document processing through Turnitin",
  "permissions": [
    "storage",
    "activeTab",
    "tabs",
    "downloads"
  ],
  "host_permissions": [
    "https://www.turnitin.com/*",
    "https://*.turnitin.com/*",
    "${import.meta.env.VITE_SUPABASE_URL}/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.turnitin.com/*", "https://*.turnitin.com/*"],
      "js": ["content-turnitin.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_page": "options.html",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}`;

  // Background service worker
  const backgroundJs = `// PlagaiScans Extension - Background Service Worker
const API_URL = '${apiUrl}';
let isProcessing = false;
let currentDocument = null;
let pollingInterval = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('PlagaiScans Extension installed');
  chrome.storage.local.set({ 
    isEnabled: false, 
    apiToken: '', 
    pollingIntervalMs: 30000,
    status: 'idle'
  });
});

// Start/stop processing based on settings
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.isEnabled) {
    if (changes.isEnabled.newValue) {
      startPolling();
    } else {
      stopPolling();
    }
  }
});

async function getSettings() {
  return chrome.storage.local.get(['apiToken', 'pollingIntervalMs', 'isEnabled']);
}

async function updateStatus(status, details = {}) {
  await chrome.storage.local.set({ status, ...details });
}

function startPolling() {
  if (pollingInterval) return;
  
  console.log('Starting polling...');
  pollForDocuments();
  pollingInterval = setInterval(pollForDocuments, 30000);
  
  // Start heartbeat
  sendHeartbeat();
  setInterval(sendHeartbeat, 60000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  updateStatus('idle');
  console.log('Polling stopped');
}

async function sendHeartbeat() {
  const { apiToken } = await getSettings();
  if (!apiToken) return;
  
  try {
    await fetch(\`\${API_URL}/heartbeat\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiToken}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        browserInfo: navigator.userAgent.substring(0, 100)
      })
    });
  } catch (error) {
    console.error('Heartbeat failed:', error);
  }
}

async function pollForDocuments() {
  if (isProcessing) {
    console.log('Already processing, skipping poll');
    return;
  }
  
  const { apiToken, isEnabled } = await getSettings();
  if (!apiToken || !isEnabled) return;
  
  try {
    await updateStatus('polling');
    
    const response = await fetch(\`\${API_URL}/pending\`, {
      headers: { 'Authorization': \`Bearer \${apiToken}\` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch pending documents');
    
    const { documents } = await response.json();
    
    if (documents.length > 0) {
      await updateStatus('found_document', { pendingCount: documents.length });
      await processDocument(documents[0]);
    } else {
      await updateStatus('waiting', { pendingCount: 0 });
    }
  } catch (error) {
    console.error('Polling error:', error);
    await updateStatus('error', { errorMessage: error.message });
    await logError(error.message);
  }
}

async function processDocument(doc) {
  isProcessing = true;
  currentDocument = doc;
  
  const { apiToken } = await getSettings();
  
  try {
    await updateStatus('downloading', { currentDocument: doc.file_name });
    
    // Download the document
    const downloadResponse = await fetch(\`\${API_URL}/download/\${doc.id}\`, {
      headers: { 'Authorization': \`Bearer \${apiToken}\` }
    });
    
    if (!downloadResponse.ok) throw new Error('Failed to download document');
    
    const { url: downloadUrl, fileName } = await downloadResponse.json();
    
    // Get available slots
    const slotsResponse = await fetch(\`\${API_URL}/slots\`, {
      headers: { 'Authorization': \`Bearer \${apiToken}\` }
    });
    
    if (!slotsResponse.ok) throw new Error('Failed to fetch slots');
    
    const { slots } = await slotsResponse.json();
    
    // Find best slot (lowest usage)
    const availableSlots = slots.filter(s => s.current_usage < s.max_files_per_day);
    
    if (availableSlots.length === 0) {
      throw new Error('All slots are at capacity');
    }
    
    const bestSlot = availableSlots.sort((a, b) => a.current_usage - b.current_usage)[0];
    
    await updateStatus('uploading_to_turnitin', { 
      currentDocument: doc.file_name,
      slot: bestSlot.slot_name
    });
    
    // Store document info for content script
    await chrome.storage.local.set({
      pendingUpload: {
        documentId: doc.id,
        downloadUrl,
        fileName,
        slotId: bestSlot.id,
        slotUrl: bestSlot.slot_url
      }
    });
    
    // Open Turnitin slot URL
    chrome.tabs.create({ url: bestSlot.slot_url });
    
    // Content script will handle the rest
    
  } catch (error) {
    console.error('Processing error:', error);
    await updateStatus('error', { errorMessage: error.message });
    await logError(error.message, doc.id);
    isProcessing = false;
    currentDocument = null;
  }
}

async function logError(message, documentId = null) {
  const { apiToken } = await getSettings();
  if (!apiToken) return;
  
  try {
    await fetch(\`\${API_URL}/error\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiToken}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, documentId })
    });
  } catch (e) {
    console.error('Failed to log error:', e);
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPLOAD_COMPLETE') {
    handleUploadComplete(message.data);
    sendResponse({ success: true });
  } else if (message.type === 'REPORT_CAPTURED') {
    handleReportCaptured(message.data);
    sendResponse({ success: true });
  } else if (message.type === 'PROCESSING_STATUS') {
    updateStatus(message.status, message.data);
    sendResponse({ success: true });
  }
  return true;
});

async function handleUploadComplete(data) {
  const { apiToken } = await getSettings();
  
  // Update slot usage
  try {
    await fetch(\`\${API_URL}/slots/update-usage\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiToken}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ slotId: data.slotId })
    });
  } catch (e) {
    console.error('Failed to update slot usage:', e);
  }
  
  await updateStatus('waiting_for_processing', { currentDocument: data.fileName });
}

async function handleReportCaptured(data) {
  const { apiToken } = await getSettings();
  
  try {
    await updateStatus('uploading_report');
    
    // Convert base64 to blob
    const response = await fetch(data.reportImage);
    const blob = await response.blob();
    
    // Upload to API
    const formData = new FormData();
    formData.append('documentId', data.documentId);
    formData.append('similarityPercentage', data.similarityPercentage || '');
    formData.append('report', blob, 'similarity_report.png');
    formData.append('remarks', data.remarks || '');
    
    const uploadResponse = await fetch(\`\${API_URL}/upload-report\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiToken}\`
      },
      body: formData
    });
    
    if (!uploadResponse.ok) throw new Error('Failed to upload report');
    
    await updateStatus('completed', { lastProcessed: data.documentId });
    
    // Clear pending upload
    await chrome.storage.local.remove(['pendingUpload']);
    
    // Close the Turnitin tab
    if (data.tabId) {
      chrome.tabs.remove(data.tabId);
    }
    
  } catch (error) {
    console.error('Report upload error:', error);
    await updateStatus('error', { errorMessage: error.message });
    await logError(error.message, data.documentId);
  } finally {
    isProcessing = false;
    currentDocument = null;
  }
}

// Export for popup
self.getProcessingStatus = async () => {
  return chrome.storage.local.get(['status', 'currentDocument', 'pendingCount', 'errorMessage']);
};
`;

  // Content script for Turnitin
  const contentTurnitinJs = `// PlagaiScans Extension - Turnitin Content Script
(async function() {
  console.log('PlagaiScans: Content script loaded on Turnitin');
  
  // Check if we have a pending upload
  const { pendingUpload } = await chrome.storage.local.get(['pendingUpload']);
  
  if (!pendingUpload) {
    console.log('PlagaiScans: No pending upload');
    return;
  }
  
  const { documentId, downloadUrl, fileName, slotId } = pendingUpload;
  
  // Detect page type
  const isSubmissionPage = window.location.href.includes('/submit') || 
                           document.querySelector('input[type="file"]');
  const isReportPage = window.location.href.includes('/report') || 
                       window.location.href.includes('/similarity');
  const isProcessingPage = document.body.innerText.includes('Processing') ||
                           document.body.innerText.includes('In Progress');
  
  if (isSubmissionPage) {
    await handleSubmissionPage(documentId, downloadUrl, fileName, slotId);
  } else if (isReportPage) {
    await handleReportPage(documentId);
  } else if (isProcessingPage) {
    // Wait and refresh
    chrome.runtime.sendMessage({ 
      type: 'PROCESSING_STATUS', 
      status: 'turnitin_processing',
      data: { documentId }
    });
    
    setTimeout(() => {
      window.location.reload();
    }, 30000);
  }
  
  async function handleSubmissionPage(docId, downloadUrl, fileName, slotId) {
    console.log('PlagaiScans: Handling submission page');
    
    chrome.runtime.sendMessage({ 
      type: 'PROCESSING_STATUS', 
      status: 'uploading_to_turnitin',
      data: { documentId: docId }
    });
    
    try {
      // Download the file
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type });
      
      // Find file input
      const fileInput = document.querySelector('input[type="file"]');
      if (!fileInput) {
        throw new Error('File input not found on page');
      }
      
      // Create a DataTransfer to set the file
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      
      // Trigger change event
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Wait for form to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Find and click submit button
      const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], .submit-button, [data-action="submit"]');
      if (submitBtn) {
        submitBtn.click();
        
        chrome.runtime.sendMessage({ 
          type: 'UPLOAD_COMPLETE', 
          data: { documentId: docId, fileName, slotId }
        });
      } else {
        console.log('PlagaiScans: Submit button not found, please submit manually');
      }
      
    } catch (error) {
      console.error('PlagaiScans: Upload error:', error);
      chrome.runtime.sendMessage({ 
        type: 'PROCESSING_STATUS', 
        status: 'error',
        data: { errorMessage: error.message }
      });
    }
  }
  
  async function handleReportPage(docId) {
    console.log('PlagaiScans: Handling report page');
    
    chrome.runtime.sendMessage({ 
      type: 'PROCESSING_STATUS', 
      status: 'capturing_report',
      data: { documentId: docId }
    });
    
    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to extract similarity percentage
    let similarityPercentage = null;
    const percentageElements = document.querySelectorAll('[class*="percent"], [class*="score"], [class*="similarity"]');
    for (const el of percentageElements) {
      const match = el.innerText.match(/(\\d+)\\s*%/);
      if (match) {
        similarityPercentage = match[1];
        break;
      }
    }
    
    // Also check for common percentage patterns in the page
    if (!similarityPercentage) {
      const pageText = document.body.innerText;
      const match = pageText.match(/similarity[:\\s]*(\\d+)\\s*%/i) || 
                    pageText.match(/(\\d+)\\s*%\\s*similar/i);
      if (match) {
        similarityPercentage = match[1];
      }
    }
    
    // Capture screenshot using html2canvas or Canvas API
    try {
      // Try to capture the report area
      const reportArea = document.querySelector('.report-container, .similarity-report, main, #report') || document.body;
      
      // Use Canvas API to capture
      const canvas = document.createElement('canvas');
      const rect = reportArea.getBoundingClientRect();
      canvas.width = Math.min(rect.width, 1920);
      canvas.height = Math.min(rect.height, 1080);
      
      // For proper capture, we'd need html2canvas library
      // For now, notify background to use chrome.tabs.captureVisibleTab
      
      chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT_REQUEST',
        data: { documentId: docId, similarityPercentage }
      });
      
      // Alternative: Send the current tab info to background for screenshot
      // The background script will use chrome.tabs.captureVisibleTab
      
    } catch (error) {
      console.error('PlagaiScans: Screenshot error:', error);
    }
  }
})();
`;

  // Popup HTML
  const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      width: 320px; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #fff;
      padding: 16px;
    }
    .header { 
      display: flex; 
      align-items: center; 
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #333;
    }
    .header h1 { font-size: 16px; font-weight: 600; }
    .status-card {
      background: #252542;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .status-label { color: #888; font-size: 12px; }
    .status-value { font-size: 14px; font-weight: 500; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-idle { background: #333; }
    .status-active { background: #10b981; color: #fff; }
    .status-processing { background: #3b82f6; color: #fff; }
    .status-error { background: #ef4444; color: #fff; }
    .toggle-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: #252542;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .toggle {
      position: relative;
      width: 48px;
      height: 24px;
      background: #333;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .toggle.active { background: #10b981; }
    .toggle::after {
      content: '';
      position: absolute;
      width: 20px;
      height: 20px;
      background: #fff;
      border-radius: 50%;
      top: 2px;
      left: 2px;
      transition: transform 0.2s;
    }
    .toggle.active::after { transform: translateX(24px); }
    .btn {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      margin-bottom: 8px;
    }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-secondary { background: #333; color: #fff; }
    .btn:hover { opacity: 0.9; }
    .queue-count {
      text-align: center;
      padding: 16px;
      background: #252542;
      border-radius: 8px;
    }
    .queue-number { font-size: 32px; font-weight: 700; color: #3b82f6; }
    .queue-label { font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <img src="icons/icon48.png" width="32" height="32" alt="Logo">
    <h1>PlagaiScans Extension</h1>
  </div>
  
  <div class="toggle-container">
    <span>Auto-Processing</span>
    <div class="toggle" id="enableToggle"></div>
  </div>
  
  <div class="status-card">
    <div class="status-row">
      <span class="status-label">Status</span>
      <span class="status-badge status-idle" id="statusBadge">Idle</span>
    </div>
    <div class="status-row">
      <span class="status-label">Current Document</span>
      <span class="status-value" id="currentDoc">-</span>
    </div>
  </div>
  
  <div class="queue-count">
    <div class="queue-number" id="queueCount">0</div>
    <div class="queue-label">Documents in Queue</div>
  </div>
  
  <div style="margin-top: 12px;">
    <button class="btn btn-secondary" id="refreshBtn">Refresh Status</button>
    <button class="btn btn-secondary" id="settingsBtn">Settings</button>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>`;

  // Popup JS
  const popupJs = `document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enableToggle');
  const statusBadge = document.getElementById('statusBadge');
  const currentDoc = document.getElementById('currentDoc');
  const queueCount = document.getElementById('queueCount');
  const refreshBtn = document.getElementById('refreshBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  
  // Load current state
  const settings = await chrome.storage.local.get(['isEnabled', 'status', 'currentDocument', 'pendingCount']);
  
  if (settings.isEnabled) {
    enableToggle.classList.add('active');
  }
  
  updateStatusUI(settings);
  
  // Toggle handler
  enableToggle.addEventListener('click', async () => {
    const current = await chrome.storage.local.get(['isEnabled', 'apiToken']);
    
    if (!current.apiToken && !current.isEnabled) {
      alert('Please configure your API token in Settings first.');
      chrome.runtime.openOptionsPage();
      return;
    }
    
    const newValue = !current.isEnabled;
    await chrome.storage.local.set({ isEnabled: newValue });
    enableToggle.classList.toggle('active', newValue);
  });
  
  // Refresh button
  refreshBtn.addEventListener('click', async () => {
    const settings = await chrome.storage.local.get(['status', 'currentDocument', 'pendingCount']);
    updateStatusUI(settings);
  });
  
  // Settings button
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  function updateStatusUI(settings) {
    const status = settings.status || 'idle';
    statusBadge.textContent = status.replace(/_/g, ' ');
    statusBadge.className = 'status-badge status-' + (
      status === 'idle' ? 'idle' :
      status.includes('error') ? 'error' :
      status.includes('processing') || status.includes('uploading') ? 'processing' :
      'active'
    );
    
    currentDoc.textContent = settings.currentDocument || '-';
    queueCount.textContent = settings.pendingCount || '0';
  }
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.status || changes.currentDocument || changes.pendingCount) {
      chrome.storage.local.get(['status', 'currentDocument', 'pendingCount']).then(updateStatusUI);
    }
  });
});`;

  // Options HTML
  const optionsHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PlagaiScans Extension Settings</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 40px;
      max-width: 600px;
      margin: 0 auto;
    }
    h1 { font-size: 24px; margin-bottom: 24px; color: #1a1a2e; }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 24px;
    }
    .form-group { margin-bottom: 20px; }
    label { display: block; font-weight: 500; margin-bottom: 8px; color: #333; }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
    }
    input:focus { outline: none; border-color: #3b82f6; }
    .help-text { font-size: 12px; color: #666; margin-top: 4px; }
    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-primary:hover { background: #2563eb; }
    .success { color: #10b981; margin-top: 12px; display: none; }
  </style>
</head>
<body>
  <h1>Extension Settings</h1>
  
  <div class="card">
    <div class="form-group">
      <label for="apiToken">API Token</label>
      <input type="password" id="apiToken" placeholder="Paste your API token here">
      <p class="help-text">Get your token from the Extension Manager in the admin dashboard.</p>
    </div>
    
    <div class="form-group">
      <label for="apiUrl">API URL (auto-configured)</label>
      <input type="text" id="apiUrl" value="${apiUrl}" readonly>
    </div>
    
    <button class="btn btn-primary" id="saveBtn">Save Settings</button>
    <p class="success" id="successMsg">Settings saved successfully!</p>
  </div>
  
  <script src="options.js"></script>
</body>
</html>`;

  // Options JS
  const optionsJs = `document.addEventListener('DOMContentLoaded', async () => {
  const apiTokenInput = document.getElementById('apiToken');
  const saveBtn = document.getElementById('saveBtn');
  const successMsg = document.getElementById('successMsg');
  
  // Load saved token
  const { apiToken } = await chrome.storage.local.get(['apiToken']);
  if (apiToken) {
    apiTokenInput.value = apiToken;
  }
  
  saveBtn.addEventListener('click', async () => {
    const token = apiTokenInput.value.trim();
    
    if (!token) {
      alert('Please enter an API token');
      return;
    }
    
    await chrome.storage.local.set({ apiToken: token });
    
    successMsg.style.display = 'block';
    setTimeout(() => {
      successMsg.style.display = 'none';
    }, 3000);
  });
});`;

  const extensionFiles = [
    { name: "manifest.json", content: manifestJson, lang: "json" },
    { name: "background.js", content: backgroundJs, lang: "javascript" },
    { name: "content-turnitin.js", content: contentTurnitinJs, lang: "javascript" },
    { name: "popup.html", content: popupHtml, lang: "html" },
    { name: "popup.js", content: popupJs, lang: "javascript" },
    { name: "options.html", content: optionsHtml, lang: "html" },
    { name: "options.js", content: optionsJs, lang: "javascript" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Extension Setup</h1>
          <p className="text-muted-foreground">
            Install and configure the Chrome extension for automated Turnitin processing
          </p>
        </div>

        <Tabs defaultValue="instructions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="instructions" className="gap-2">
              <Chrome className="h-4 w-4" />
              Installation
            </TabsTrigger>
            <TabsTrigger value="configuration" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-2">
              <FileCode className="h-4 w-4" />
              Extension Code
            </TabsTrigger>
          </TabsList>

          {/* Instructions Tab */}
          <TabsContent value="instructions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Chrome className="h-5 w-5" />
                  Chrome Extension Installation
                </CardTitle>
                <CardDescription>
                  Follow these steps to install the extension in Developer Mode
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold">Download Extension Files</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Go to the "Extension Code" tab and copy all the files. Create a new folder 
                        called <code className="bg-muted px-1 py-0.5 rounded">turnitin-extension</code> on your computer.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold">Create Icon Files</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Create an <code className="bg-muted px-1 py-0.5 rounded">icons</code> folder inside 
                        your extension folder. Add icon16.png, icon48.png, and icon128.png files.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold">Open Chrome Extensions</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Open Chrome and go to <code className="bg-muted px-1 py-0.5 rounded">chrome://extensions</code>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold">Enable Developer Mode</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Toggle "Developer mode" switch in the top-right corner of the extensions page.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      5
                    </div>
                    <div>
                      <h4 className="font-semibold">Load Unpacked Extension</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Click "Load unpacked" and select your extension folder.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      6
                    </div>
                    <div>
                      <h4 className="font-semibold">Configure Token</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Get your API token from the Extension Manager (admin) and paste it in the extension settings.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-800 dark:text-amber-200">Important Notes</h4>
                      <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 space-y-1 list-disc list-inside">
                        <li>You must be logged into Turnitin in the same browser</li>
                        <li>Keep the browser window open for the extension to work</li>
                        <li>The extension processes documents automatically in the background</li>
                        <li>Check the popup for current status and queue count</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="configuration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Extension Configuration</CardTitle>
                <CardDescription>
                  Settings to configure in the extension
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">API URL</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => copyToClipboard(apiUrl, "api-url")}
                    >
                      {copiedFile === "api-url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      Copy
                    </Button>
                  </div>
                  <code className="block bg-muted p-2 rounded text-sm break-all">
                    {apiUrl}
                  </code>
                  <p className="text-xs text-muted-foreground">
                    This is pre-configured in the extension files. You just need to add your API token.
                  </p>
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-medium">API Token</h4>
                  <p className="text-sm text-muted-foreground">
                    Get your API token from the <strong>Extension Manager</strong> page (admin access required).
                    Then paste it in the extension's Settings page.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Code Tab */}
          <TabsContent value="code" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Extension Source Code</CardTitle>
                <CardDescription>
                  Copy each file and save it in your extension folder
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {extensionFiles.map((file) => (
                    <div key={file.name} className="rounded-lg border">
                      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileCode className="h-4 w-4" />
                          <span className="font-medium">{file.name}</span>
                          <Badge variant="secondary">{file.lang}</Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => copyToClipboard(file.content, file.name)}
                        >
                          {copiedFile === file.name ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <ScrollArea className="h-[300px]">
                        <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                          {file.content}
                        </pre>
                      </ScrollArea>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200">Folder Structure</h4>
                  <pre className="mt-2 text-sm text-blue-700 dark:text-blue-300">
{`turnitin-extension/
├── manifest.json
├── background.js
├── content-turnitin.js
├── popup.html
├── popup.js
├── options.html
├── options.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ExtensionSetup;
