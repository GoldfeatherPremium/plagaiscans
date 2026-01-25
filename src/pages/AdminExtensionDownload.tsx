import React, { useState } from 'react';
import JSZip from 'jszip';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Chrome, Settings, FileCheck, AlertCircle, CheckCircle2, Key } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ExtensionTokenManager } from '@/components/ExtensionTokenManager';

// Extension file contents embedded as strings
const manifestJson = `{
  "manifest_version": 3,
  "name": "Plagaiscans Turnitin Automation",
  "version": "1.0.0",
  "description": "Automatically process documents through Turnitin and upload reports to Plagaiscans",
  "permissions": [
    "storage",
    "tabs",
    "downloads",
    "alarms",
    "notifications"
  ],
  "host_permissions": [
    "https://*.turnitin.com/*",
    "https://fyssbzgmhnolazjfwafm.supabase.co/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://*.turnitin.com/*"],
      "js": ["content.js"],
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

const backgroundJs = `// Plagaiscans Turnitin Automation - Background Service Worker
const SUPABASE_URL = 'https://fyssbzgmhnolazjfwafm.supabase.co';
const EXTENSION_API_URL = SUPABASE_URL + '/functions/v1/extension-api';
const POLL_INTERVAL_MS = 10000;
const MAX_PROCESSING_TIME_MS = 30 * 60 * 1000;

let isProcessing = false;
let currentDocumentId = null;
let isEnabled = true;
let extensionToken = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Plagaiscans Turnitin Automation installed');
  chrome.storage.local.set({ 
    isEnabled: true,
    processedCount: 0,
    lastError: null,
    currentStatus: 'idle'
  });
  chrome.alarms.create('pollDocuments', { periodInMinutes: 0.17 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pollDocuments') {
    await checkForPendingDocuments();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
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
      console.log('Turnitin page ready');
      sendResponse({ acknowledged: true });
      break;
    case 'UPLOAD_COMPLETE':
      await handleUploadComplete(message.data);
      sendResponse({ success: true });
      break;
    case 'REPORTS_READY':
      await handleReportsReady(message.data);
      sendResponse({ success: true });
      break;
    case 'AUTOMATION_ERROR':
      await handleAutomationError(message.error);
      sendResponse({ acknowledged: true });
      break;
    case 'REQUEST_FILE':
      const fileData = await getFileForUpload();
      sendResponse(fileData);
      break;
    default:
      sendResponse({ error: 'Unknown message type' });
  }
}

async function getStatus() {
  const data = await chrome.storage.local.get([
    'isEnabled', 'processedCount', 'lastError', 'currentStatus',
    'currentDocumentName', 'turnitinCredentials'
  ]);
  return {
    isEnabled: data.isEnabled ?? true,
    isProcessing,
    currentDocumentId,
    currentDocumentName: data.currentDocumentName,
    processedCount: data.processedCount ?? 0,
    lastError: data.lastError,
    currentStatus: data.currentStatus ?? 'idle',
    hasCredentials: !!data.turnitinCredentials?.email
  };
}

async function getSupabaseKey() {
  if (supabaseKey) return supabaseKey;
  const data = await chrome.storage.local.get(['supabaseServiceKey']);
  supabaseKey = data.supabaseServiceKey;
  return supabaseKey;
}

async function supabaseRequest(endpoint, options = {}) {
  const key = await getSupabaseKey();
  if (!key) throw new Error('Supabase service key not configured');
  
  const url = \`\${SUPABASE_URL}/rest/v1/\${endpoint}\`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'apikey': key,
      'Authorization': \`Bearer \${key}\`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(\`Supabase error: \${response.status} - \${error}\`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function checkForPendingDocuments() {
  if (!isEnabled || isProcessing) return;
  
  try {
    const key = await getSupabaseKey();
    if (!key) return;
    
    const creds = await chrome.storage.local.get(['turnitinCredentials']);
    if (!creds.turnitinCredentials?.email) return;
    
    const documents = await supabaseRequest(
      'documents?status=eq.pending&automation_status=is.null&order=uploaded_at.asc&limit=1'
    );
    
    if (documents && documents.length > 0) {
      await processDocument(documents[0]);
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
    console.log(\`Processing document: \${document.file_name}\`);
    await chrome.storage.local.set({ 
      currentStatus: 'processing',
      currentDocumentName: document.file_name
    });
    
    await supabaseRequest(\`documents?id=eq.\${document.id}\`, {
      method: 'PATCH',
      body: JSON.stringify({
        automation_status: 'processing',
        automation_started_at: new Date().toISOString(),
        automation_attempt_count: (document.automation_attempt_count || 0) + 1
      })
    });
    
    await logAutomation(document.id, 'processing_started', 'info', 'Started processing document');
    await chrome.storage.local.set({ currentStatus: 'downloading' });
    const fileData = await downloadFile(document.file_path);
    
    await chrome.storage.local.set({ 
      currentFileData: fileData,
      currentFileName: document.file_name,
      currentFilePath: document.file_path,
      currentScanType: document.scan_type
    });
    
    await chrome.storage.local.set({ currentStatus: 'opening_turnitin' });
    const tab = await chrome.tabs.create({ 
      url: 'https://www.turnitin.com/login_page.asp',
      active: false
    });
    await chrome.storage.local.set({ turnitinTabId: tab.id });
  } catch (error) {
    console.error('Error processing document:', error);
    await handleAutomationError(error.message);
  }
}

async function downloadFile(filePath) {
  const key = await getSupabaseKey();
  const response = await fetch(
    \`\${SUPABASE_URL}/storage/v1/object/sign/documents/\${filePath}\`,
    {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': \`Bearer \${key}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: 3600 })
    }
  );
  
  if (!response.ok) throw new Error('Failed to get signed URL');
  const { signedURL } = await response.json();
  
  const fileResponse = await fetch(\`\${SUPABASE_URL}/storage/v1\${signedURL}\`);
  if (!fileResponse.ok) throw new Error('Failed to download file');
  
  const blob = await fileResponse.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
  
  return { base64, mimeType: blob.type, size: blob.size };
}

async function getFileForUpload() {
  const data = await chrome.storage.local.get(['currentFileData', 'currentFileName']);
  return { fileData: data.currentFileData, fileName: data.currentFileName };
}

async function handleUploadComplete(data) {
  console.log('Upload complete', data);
  await chrome.storage.local.set({ 
    currentStatus: 'waiting_for_results',
    turnitinSubmissionId: data.submissionId
  });
  await logAutomation(currentDocumentId, 'upload_complete', 'info', 
    \`Document uploaded. Submission ID: \${data.submissionId}\`);
}

async function handleReportsReady(data) {
  console.log('Reports ready', data);
  try {
    await chrome.storage.local.set({ currentStatus: 'uploading_reports' });
    const key = await getSupabaseKey();
    
    if (data.similarityReport) {
      const path = \`\${currentDocumentId}/similarity_report.pdf\`;
      await uploadToStorage('reports', path, data.similarityReport, 'application/pdf', key);
      await supabaseRequest(\`documents?id=eq.\${currentDocumentId}\`, {
        method: 'PATCH',
        body: JSON.stringify({
          similarity_report_path: path,
          similarity_percentage: data.similarityPercentage
        })
      });
    }
    
    if (data.aiReport) {
      const path = \`\${currentDocumentId}/ai_report.pdf\`;
      await uploadToStorage('reports', path, data.aiReport, 'application/pdf', key);
      await supabaseRequest(\`documents?id=eq.\${currentDocumentId}\`, {
        method: 'PATCH',
        body: JSON.stringify({
          ai_report_path: path,
          ai_percentage: data.aiPercentage
        })
      });
    }
    
    await supabaseRequest(\`documents?id=eq.\${currentDocumentId}\`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'completed',
        automation_status: 'completed',
        completed_at: new Date().toISOString()
      })
    });
    
    await logAutomation(currentDocumentId, 'processing_complete', 'success', 
      \`Similarity: \${data.similarityPercentage}%, AI: \${data.aiPercentage || 'N/A'}%\`);
    
    const storage = await chrome.storage.local.get(['processedCount']);
    await chrome.storage.local.set({ 
      processedCount: (storage.processedCount || 0) + 1,
      currentStatus: 'idle',
      lastProcessedAt: new Date().toISOString()
    });
    
    const { turnitinTabId } = await chrome.storage.local.get(['turnitinTabId']);
    if (turnitinTabId) {
      try { await chrome.tabs.remove(turnitinTabId); } catch (e) {}
    }
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Document Processed',
      message: \`\${data.fileName || 'Document'} processed successfully\`
    });
    
    isProcessing = false;
    currentDocumentId = null;
    
    await chrome.storage.local.remove([
      'currentFileData', 'currentFileName', 'currentFilePath',
      'currentScanType', 'turnitinTabId', 'turnitinSubmissionId'
    ]);
  } catch (error) {
    console.error('Error handling reports:', error);
    await handleAutomationError(error.message);
  }
}

async function uploadToStorage(bucket, path, base64Data, contentType, key) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  
  const response = await fetch(\`\${SUPABASE_URL}/storage/v1/object/\${bucket}/\${path}\`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': \`Bearer \${key}\`,
      'Content-Type': contentType,
      'x-upsert': 'true'
    },
    body: byteArray
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(\`Failed to upload: \${error}\`);
  }
  return response.json();
}

async function handleAutomationError(errorMessage) {
  console.error('Automation error:', errorMessage);
  
  if (currentDocumentId) {
    try {
      await supabaseRequest(\`documents?id=eq.\${currentDocumentId}\`, {
        method: 'PATCH',
        body: JSON.stringify({
          automation_status: 'failed',
          automation_error: errorMessage
        })
      });
      await logAutomation(currentDocumentId, 'processing_failed', 'error', errorMessage);
    } catch (e) {}
  }
  
  await chrome.storage.local.set({ 
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
  
  const { turnitinTabId } = await chrome.storage.local.get(['turnitinTabId']);
  if (turnitinTabId) {
    try { await chrome.tabs.remove(turnitinTabId); } catch (e) {}
  }
  
  await chrome.storage.local.remove([
    'currentFileData', 'currentFileName', 'currentFilePath',
    'currentScanType', 'turnitinTabId', 'turnitinSubmissionId'
  ]);
}

async function logAutomation(documentId, action, status, message) {
  try {
    await supabaseRequest('automation_logs', {
      method: 'POST',
      body: JSON.stringify({
        document_id: documentId,
        action,
        status,
        message,
        metadata: {
          timestamp: new Date().toISOString(),
          extensionVersion: chrome.runtime.getManifest().version
        }
      })
    });
  } catch (e) {
    console.error('Failed to log automation:', e);
  }
}

async function logError(action, message) {
  await chrome.storage.local.set({ lastError: message });
}

checkForPendingDocuments();`;

const contentJs = `// Plagaiscans Turnitin Automation - Content Script
console.log('Plagaiscans Turnitin Automation content script loaded');

let isAutomating = false;
let currentStep = null;
const WAIT_TIMEOUT = 60000;
const CHECK_INTERVAL = 2000;
const ACTION_DELAY = 1500;

init();

async function init() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_DOCUMENT' });
  if (response?.documentId) {
    console.log('Automation active for document:', response.documentId);
    isAutomating = true;
    await chrome.runtime.sendMessage({ type: 'TURNITIN_READY' });
    await detectPageAndAct();
  }
}

async function detectPageAndAct() {
  const url = window.location.href;
  try {
    if (url.includes('login') || url.includes('Login')) {
      await handleLoginPage();
    } else if (url.includes('home') || url.includes('dashboard')) {
      await handleDashboard();
    } else if (url.includes('submission') || url.includes('upload')) {
      await handleSubmissionPage();
    } else if (url.includes('report') || url.includes('viewer')) {
      await handleReportPage();
    } else {
      await detectByContent();
    }
  } catch (error) {
    console.error('Automation error:', error);
    await chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: error.message });
  }
}

async function detectByContent() {
  await wait(2000);
  const loginForm = document.querySelector('form[action*="login"]') || document.querySelector('input[type="password"]');
  if (loginForm) { await handleLoginPage(); return; }
  const classLinks = document.querySelectorAll('a[href*="class"], .class-item');
  if (classLinks.length > 0) { await handleDashboard(); return; }
  const fileInput = document.querySelector('input[type="file"]');
  if (fileInput) { await handleSubmissionPage(); return; }
  console.log('Unknown page type');
}

async function handleLoginPage() {
  console.log('Handling login page');
  const data = await chrome.storage.local.get(['turnitinCredentials']);
  const creds = data.turnitinCredentials;
  if (!creds?.email || !creds?.password) throw new Error('Turnitin credentials not configured');
  
  await waitForElement('input[type="email"], input[name="email"], #email, input[type="text"]');
  const emailInput = document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]') || document.querySelector('#email') || document.querySelector('input[type="text"]');
  if (emailInput) await simulateTyping(emailInput, creds.email);
  await wait(ACTION_DELAY);
  
  const passwordInput = document.querySelector('input[type="password"]') || document.querySelector('input[name="password"]');
  if (passwordInput) await simulateTyping(passwordInput, creds.password);
  await wait(ACTION_DELAY);
  
  const submitButton = document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]') || document.querySelector('.login-button');
  if (submitButton) {
    submitButton.click();
    console.log('Login submitted');
    await waitForNavigation();
    await detectPageAndAct();
  } else {
    throw new Error('Could not find login submit button');
  }
}

async function handleDashboard() {
  console.log('Handling dashboard');
  await wait(2000);
  const classLink = document.querySelector('a[href*="class"]') || document.querySelector('.class-name');
  if (classLink) {
    classLink.click();
    await waitForNavigation();
    await detectPageAndAct();
  } else {
    const submitLink = document.querySelector('a[href*="submit"]');
    if (submitLink) {
      submitLink.click();
      await waitForNavigation();
      await detectPageAndAct();
    } else {
      throw new Error('Could not find class or submit link');
    }
  }
}

async function handleSubmissionPage() {
  console.log('Handling submission page');
  const fileInfo = await chrome.runtime.sendMessage({ type: 'REQUEST_FILE' });
  if (!fileInfo?.fileData) throw new Error('No file data received');
  
  const byteCharacters = atob(fileInfo.fileData.base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: fileInfo.fileData.mimeType });
  const file = new File([blob], fileInfo.fileName, { type: fileInfo.fileData.mimeType });
  
  const fileInput = await waitForElement('input[type="file"]');
  if (!fileInput) throw new Error('Could not find file input');
  
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  
  await wait(ACTION_DELAY);
  const titleInput = document.querySelector('input[name="title"]') || document.querySelector('#submission-title');
  if (titleInput) await simulateTyping(titleInput, fileInfo.fileName.replace(/\\.[^.]+$/, ''));
  await wait(ACTION_DELAY);
  
  const submitButton = document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]');
  if (submitButton) {
    submitButton.click();
    await waitForSubmissionConfirmation();
  } else {
    throw new Error('Could not find submit button');
  }
}

async function waitForSubmissionConfirmation() {
  console.log('Waiting for confirmation');
  const startTime = Date.now();
  while (Date.now() - startTime < WAIT_TIMEOUT * 2) {
    await wait(CHECK_INTERVAL);
    const success = document.querySelector('.submission-success') || document.body.innerText.includes('successfully submitted');
    if (success) {
      console.log('Submission confirmed!');
      const submissionId = extractSubmissionId();
      await chrome.runtime.sendMessage({ type: 'UPLOAD_COMPLETE', data: { submissionId } });
      await waitForReports();
      return;
    }
    if (window.location.href.includes('report')) { await handleReportPage(); return; }
  }
  throw new Error('Timeout waiting for confirmation');
}

function extractSubmissionId() {
  const urlMatch = window.location.href.match(/submission[_-]?id[=\\/](\\w+)/i);
  if (urlMatch) return urlMatch[1];
  return null;
}

async function waitForReports() {
  console.log('Waiting for reports');
  const startTime = Date.now();
  const maxWait = 20 * 60 * 1000;
  while (Date.now() - startTime < maxWait) {
    await wait(CHECK_INTERVAL * 3);
    const similarityLink = document.querySelector('a[href*="similarity"]') || document.querySelector('.similarity-score');
    if (similarityLink) {
      console.log('Reports ready');
      await downloadReports();
      return;
    }
    if ((Date.now() - startTime) % 60000 < CHECK_INTERVAL * 3) {
      window.location.reload();
      await wait(5000);
    }
  }
  throw new Error('Timeout waiting for reports');
}

async function downloadReports() {
  console.log('Downloading reports');
  const reports = { similarityReport: null, aiReport: null, similarityPercentage: null, aiPercentage: null };
  
  const similarityScore = document.querySelector('.similarity-score, [data-similarity]');
  if (similarityScore) {
    const match = similarityScore.innerText.match(/(\\d+)/);
    if (match) reports.similarityPercentage = parseInt(match[1]);
  }
  
  const aiScore = document.querySelector('.ai-score, [data-ai-score]');
  if (aiScore) {
    const match = aiScore.innerText.match(/(\\d+)/);
    if (match) reports.aiPercentage = parseInt(match[1]);
  }
  
  await chrome.runtime.sendMessage({ type: 'REPORTS_READY', data: reports });
}

async function handleReportPage() {
  console.log('On report page');
  await downloadReports();
}

async function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitForElement(selector, timeout = WAIT_TIMEOUT) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await wait(500);
  }
  return null;
}

async function waitForNavigation() {
  const currentUrl = window.location.href;
  const startTime = Date.now();
  while (Date.now() - startTime < WAIT_TIMEOUT) {
    await wait(500);
    if (window.location.href !== currentUrl) {
      await wait(2000);
      return;
    }
  }
}

async function simulateTyping(element, text) {
  element.focus();
  element.value = '';
  for (const char of text) {
    element.value += char;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(50 + Math.random() * 50);
  }
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_AUTOMATION') {
    isAutomating = true;
    detectPageAndAct();
    sendResponse({ started: true });
  }
  return true;
});`;

const popupHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plagaiscans Automation</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 320px; padding: 16px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #e4e4e7; }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .header img { width: 40px; height: 40px; border-radius: 8px; }
    .header h1 { font-size: 16px; font-weight: 600; color: #fff; }
    .header p { font-size: 12px; color: #a1a1aa; }
    .status-card { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .status-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .status-row:last-child { margin-bottom: 0; }
    .status-label { font-size: 13px; color: #a1a1aa; }
    .status-value { font-size: 13px; font-weight: 500; }
    .status-indicator { display: flex; align-items: center; gap: 6px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .status-dot.idle { background: #71717a; }
    .status-dot.processing { background: #fbbf24; animation: pulse 1.5s infinite; }
    .status-dot.success { background: #22c55e; }
    .status-dot.error { background: #ef4444; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .toggle-container { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .toggle-label { font-size: 14px; font-weight: 500; }
    .toggle { position: relative; width: 48px; height: 26px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #3f3f46; transition: 0.3s; border-radius: 26px; }
    .toggle-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%; }
    .toggle input:checked + .toggle-slider { background-color: #22c55e; }
    .toggle input:checked + .toggle-slider:before { transform: translateX(22px); }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .stat-card { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 700; color: #fff; }
    .stat-label { font-size: 11px; color: #a1a1aa; margin-top: 4px; }
    .current-doc { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .current-doc-title { font-size: 11px; color: #fbbf24; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .current-doc-name { font-size: 13px; color: #fff; word-break: break-all; }
    .current-doc-status { font-size: 11px; color: #a1a1aa; margin-top: 6px; }
    .error-card { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .error-title { font-size: 11px; color: #ef4444; margin-bottom: 4px; text-transform: uppercase; }
    .error-message { font-size: 12px; color: #fca5a5; }
    .actions { display: flex; gap: 8px; }
    .btn { flex: 1; padding: 10px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-secondary { background: rgba(255,255,255,0.1); color: #e4e4e7; }
    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
    .no-creds { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 12px; }
    .no-creds p { font-size: 13px; color: #fbbf24; margin-bottom: 12px; }
    .footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; }
    .footer a { color: #3b82f6; text-decoration: none; font-size: 12px; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header"><img src="icons/icon48.png" alt="Logo"><div><h1>Plagaiscans</h1><p>Turnitin Automation</p></div></div>
  <div class="toggle-container"><span class="toggle-label">Auto-Processing</span><label class="toggle"><input type="checkbox" id="enableToggle"><span class="toggle-slider"></span></label></div>
  <div class="status-card"><div class="status-row"><span class="status-label">Status</span><div class="status-indicator"><span class="status-dot" id="statusDot"></span><span class="status-value" id="statusText">Idle</span></div></div><div class="status-row"><span class="status-label">Connection</span><span class="status-value" id="connectionStatus">Checking...</span></div></div>
  <div class="stats-grid"><div class="stat-card"><div class="stat-value" id="processedCount">0</div><div class="stat-label">Processed Today</div></div><div class="stat-card"><div class="stat-value" id="pendingCount">-</div><div class="stat-label">Pending</div></div></div>
  <div id="currentDocContainer" class="current-doc" style="display: none;"><div class="current-doc-title">Currently Processing</div><div class="current-doc-name" id="currentDocName"></div><div class="current-doc-status" id="currentDocStatus"></div></div>
  <div id="errorContainer" class="error-card" style="display: none;"><div class="error-title">Last Error</div><div class="error-message" id="errorMessage"></div></div>
  <div id="noCredsContainer" class="no-creds" style="display: none;"><p>⚠️ Turnitin credentials not configured</p><button class="btn btn-primary" id="setupBtn">Set Up Credentials</button></div>
  <div class="actions"><button class="btn btn-secondary" id="settingsBtn">Settings</button><button class="btn btn-primary" id="refreshBtn">Refresh</button></div>
  <div class="footer"><a href="https://plagaiscans.lovable.app" target="_blank">Open Plagaiscans Dashboard →</a></div>
  <script src="popup.js"></script>
</body>
</html>`;

const popupJs = `document.addEventListener('DOMContentLoaded', init);
async function init() { await updateStatus(); setupEventListeners(); setInterval(updateStatus, 3000); }
async function updateStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    document.getElementById('enableToggle').checked = status.isEnabled;
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    statusDot.className = 'status-dot';
    if (status.lastError && status.currentStatus === 'error') { statusDot.classList.add('error'); statusText.textContent = 'Error'; }
    else if (status.isProcessing) { statusDot.classList.add('processing'); statusText.textContent = formatStatus(status.currentStatus); }
    else if (status.isEnabled) { statusDot.classList.add('success'); statusText.textContent = 'Ready'; }
    else { statusDot.classList.add('idle'); statusText.textContent = 'Disabled'; }
    document.getElementById('connectionStatus').textContent = status.hasCredentials ? 'Connected' : 'Not configured';
    document.getElementById('connectionStatus').style.color = status.hasCredentials ? '#22c55e' : '#fbbf24';
    document.getElementById('processedCount').textContent = status.processedCount || 0;
    const currentDocContainer = document.getElementById('currentDocContainer');
    if (status.isProcessing && status.currentDocumentName) { currentDocContainer.style.display = 'block'; document.getElementById('currentDocName').textContent = status.currentDocumentName; document.getElementById('currentDocStatus').textContent = formatStatus(status.currentStatus); }
    else { currentDocContainer.style.display = 'none'; }
    const errorContainer = document.getElementById('errorContainer');
    if (status.lastError && !status.isProcessing) { errorContainer.style.display = 'block'; document.getElementById('errorMessage').textContent = status.lastError; }
    else { errorContainer.style.display = 'none'; }
    document.getElementById('noCredsContainer').style.display = status.hasCredentials ? 'none' : 'block';
  } catch (error) { console.error('Error updating status:', error); }
}
function formatStatus(status) { const m = { 'idle': 'Idle', 'processing': 'Processing...', 'downloading': 'Downloading...', 'opening_turnitin': 'Opening Turnitin...', 'waiting_for_results': 'Waiting for results...', 'uploading_reports': 'Uploading reports...', 'error': 'Error' }; return m[status] || status; }
function setupEventListeners() {
  document.getElementById('enableToggle').addEventListener('change', async (e) => { await chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED', enabled: e.target.checked }); await updateStatus(); });
  document.getElementById('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('setupBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('refreshBtn').addEventListener('click', async () => await updateStatus());
}`;

const optionsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plagaiscans Automation Settings</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f14; color: #e4e4e7; min-height: 100vh; padding: 40px; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; }
    .header img { width: 64px; height: 64px; border-radius: 16px; margin-bottom: 16px; }
    .header h1 { font-size: 28px; font-weight: 700; color: #fff; margin-bottom: 8px; }
    .header p { color: #a1a1aa; font-size: 14px; }
    .card { background: #1a1a2e; border-radius: 16px; padding: 24px; margin-bottom: 24px; }
    .card-title { font-size: 18px; font-weight: 600; color: #fff; margin-bottom: 8px; }
    .card-description { font-size: 13px; color: #a1a1aa; margin-bottom: 20px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; font-size: 13px; font-weight: 500; color: #e4e4e7; margin-bottom: 8px; }
    input[type="text"], input[type="email"], input[type="password"] { width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 14px; }
    input:focus { outline: none; border-color: #3b82f6; }
    input::placeholder { color: #52525b; }
    .helper-text { font-size: 12px; color: #71717a; margin-top: 6px; }
    .btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-danger { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .btn-danger:hover { background: rgba(239, 68, 68, 0.3); }
    .btn-group { display: flex; gap: 12px; margin-top: 24px; }
    .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 20px; font-size: 13px; color: #22c55e; }
    .status-badge.warning { background: rgba(251, 191, 36, 0.1); border-color: rgba(251, 191, 36, 0.3); color: #fbbf24; }
    .status-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    .success-message { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 12px 16px; color: #22c55e; font-size: 14px; margin-top: 16px; display: none; }
    .error-message { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px 16px; color: #ef4444; font-size: 14px; margin-top: 16px; display: none; }
    .warning-box { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .warning-box h4 { color: #fbbf24; font-size: 14px; margin-bottom: 8px; }
    .warning-box p { color: #a1a1aa; font-size: 13px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); }
    .footer p { color: #71717a; font-size: 13px; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><img src="icons/icon128.png" alt="Plagaiscans"><h1>Automation Settings</h1><p>Configure your Turnitin automation settings</p></div>
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;"><div><h2 class="card-title">Turnitin Credentials</h2><p class="card-description">Enter your Turnitin login details. Stored securely in your browser only.</p></div><span class="status-badge warning" id="credStatus"><span class="dot"></span>Not configured</span></div>
      <div class="warning-box"><h4>🔒 Security Notice</h4><p>Your credentials are stored locally and never sent to our servers.</p></div>
      <form id="turnitinForm"><div class="form-group"><label for="turnitinEmail">Email Address</label><input type="email" id="turnitinEmail" placeholder="your.email@university.edu"></div><div class="form-group"><label for="turnitinPassword">Password</label><input type="password" id="turnitinPassword" placeholder="••••••••••••"><p class="helper-text">Your password is encrypted and stored locally</p></div><div class="btn-group"><button type="submit" class="btn btn-primary">Save Credentials</button><button type="button" class="btn btn-danger" id="clearCredsBtn">Clear</button></div><div class="success-message" id="credSuccess">✓ Credentials saved</div><div class="error-message" id="credError"></div></form>
    </div>
    <div class="card">
      <h2 class="card-title">Backend Connection</h2><p class="card-description">Service key for connecting to Plagaiscans backend.</p>
      <form id="supabaseForm"><div class="form-group"><label for="serviceKey">Service Role Key</label><input type="password" id="serviceKey" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."><p class="helper-text">Required for the extension to access pending documents</p></div><div class="btn-group"><button type="submit" class="btn btn-primary">Save Key</button><button type="button" class="btn btn-danger" id="clearKeyBtn">Clear</button></div><div class="success-message" id="keySuccess">✓ Key saved</div><div class="error-message" id="keyError"></div></form>
    </div>
    <div class="card">
      <h2 class="card-title">Advanced Settings</h2><p class="card-description">Fine-tune the automation behavior</p>
      <div class="form-group"><label for="pollInterval">Poll Interval (seconds)</label><input type="text" id="pollInterval" placeholder="10" value="10"><p class="helper-text">How often to check for pending documents</p></div>
      <div class="form-group"><label for="maxRetries">Max Retries</label><input type="text" id="maxRetries" placeholder="3" value="3"><p class="helper-text">Number of retries on failure</p></div>
      <button type="button" class="btn btn-primary" id="saveAdvancedBtn">Save Settings</button><div class="success-message" id="advancedSuccess">✓ Settings saved</div>
    </div>
    <div class="footer"><p>Plagaiscans Turnitin Automation v1.0.0</p><p><a href="https://plagaiscans.lovable.app" target="_blank">Open Dashboard</a> • <a href="https://plagaiscans.lovable.app/contact" target="_blank">Get Help</a></p></div>
  </div>
  <script src="options.js"></script>
</body>
</html>`;

const optionsJs = `document.addEventListener('DOMContentLoaded', init);
async function init() { await loadSavedSettings(); setupEventListeners(); }
async function loadSavedSettings() {
  const data = await chrome.storage.local.get(['turnitinCredentials', 'supabaseServiceKey', 'pollInterval', 'maxRetries']);
  if (data.turnitinCredentials?.email) { document.getElementById('credStatus').className = 'status-badge'; document.getElementById('credStatus').innerHTML = '<span class="dot"></span>Configured'; document.getElementById('turnitinEmail').value = data.turnitinCredentials.email; }
  if (data.supabaseServiceKey) document.getElementById('serviceKey').placeholder = '••• Key saved •••';
  if (data.pollInterval) document.getElementById('pollInterval').value = data.pollInterval;
  if (data.maxRetries) document.getElementById('maxRetries').value = data.maxRetries;
}
function setupEventListeners() {
  document.getElementById('turnitinForm').addEventListener('submit', async (e) => { e.preventDefault(); await saveTurnitinCredentials(); });
  document.getElementById('clearCredsBtn').addEventListener('click', async () => { await chrome.storage.local.remove(['turnitinCredentials']); document.getElementById('turnitinEmail').value = ''; document.getElementById('turnitinPassword').value = ''; document.getElementById('credStatus').className = 'status-badge warning'; document.getElementById('credStatus').innerHTML = '<span class="dot"></span>Not configured'; showMessage('credSuccess', 'Credentials cleared'); });
  document.getElementById('supabaseForm').addEventListener('submit', async (e) => { e.preventDefault(); await saveServiceKey(); });
  document.getElementById('clearKeyBtn').addEventListener('click', async () => { await chrome.storage.local.remove(['supabaseServiceKey']); document.getElementById('serviceKey').value = ''; document.getElementById('serviceKey').placeholder = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; showMessage('keySuccess', 'Key cleared'); });
  document.getElementById('saveAdvancedBtn').addEventListener('click', async () => await saveAdvancedSettings());
}
async function saveTurnitinCredentials() {
  const email = document.getElementById('turnitinEmail').value.trim();
  const password = document.getElementById('turnitinPassword').value;
  if (!email) { showError('credError', 'Please enter email'); return; }
  const existing = await chrome.storage.local.get(['turnitinCredentials']);
  const savedPassword = password || existing.turnitinCredentials?.password;
  if (!savedPassword) { showError('credError', 'Please enter password'); return; }
  await chrome.storage.local.set({ turnitinCredentials: { email, password: savedPassword } });
  document.getElementById('credStatus').className = 'status-badge'; document.getElementById('credStatus').innerHTML = '<span class="dot"></span>Configured';
  document.getElementById('turnitinPassword').value = ''; showMessage('credSuccess', 'Credentials saved');
}
async function saveServiceKey() {
  const key = document.getElementById('serviceKey').value.trim();
  if (!key) { showError('keyError', 'Please enter the key'); return; }
  if (!key.startsWith('eyJ')) { showError('keyError', 'Invalid key format'); return; }
  try { const r = await fetch('https://fyssbzgmhnolazjfwafm.supabase.co/rest/v1/documents?limit=1', { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }); if (!r.ok) throw new Error(); } catch { showError('keyError', 'Connection failed'); return; }
  await chrome.storage.local.set({ supabaseServiceKey: key }); document.getElementById('serviceKey').value = ''; document.getElementById('serviceKey').placeholder = '••• Key saved •••'; showMessage('keySuccess', 'Key saved and verified');
}
async function saveAdvancedSettings() {
  const pollInterval = parseInt(document.getElementById('pollInterval').value) || 10;
  const maxRetries = parseInt(document.getElementById('maxRetries').value) || 3;
  await chrome.storage.local.set({ pollInterval: Math.max(5, Math.min(60, pollInterval)), maxRetries: Math.max(1, Math.min(10, maxRetries)) }); showMessage('advancedSuccess', 'Settings saved');
}
function showMessage(id, msg) { const el = document.getElementById(id); el.textContent = '✓ ' + msg; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 3000); }
function showError(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 5000); }`;

const readmeMd = `# Plagaiscans Turnitin Automation Extension

This Chrome/Edge browser extension automatically processes documents from your Plagaiscans queue through Turnitin.com.

## Features

- 🔄 **Automatic Processing**: Polls for pending documents and processes them automatically
- 📄 **Full Automation**: Logs into Turnitin, uploads files, waits for results, downloads reports
- 📊 **Report Upload**: Automatically uploads AI and Similarity reports back to Plagaiscans
- 🔔 **Notifications**: Get notified when documents are processed
- 🔐 **Secure**: Credentials stored locally in your browser only

## Installation

### Step 1: Extract the ZIP

1. Extract this ZIP file to a folder on your computer

### Step 2: Load in Chrome/Edge

1. Open Chrome and go to \`chrome://extensions/\` (or \`edge://extensions/\` for Edge)
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the extracted folder
5. The extension icon should appear in your toolbar

### Step 3: Configure the Extension

1. Click the extension icon in your toolbar
2. Click **Settings** to open the options page
3. Enter your **Turnitin credentials** (email and password)
4. Enter the **Service Role Key** (get this from your Plagaiscans admin)
5. Save the settings

## Usage

1. **Keep the browser open** - the extension needs Chrome/Edge running to work
2. **Toggle Auto-Processing** - click the extension icon and toggle on/off
3. **Monitor progress** - the popup shows current status and processing history

## Security Notes

- Your Turnitin credentials are **stored locally** in Chrome's secure storage
- Credentials are **never sent** to Plagaiscans servers
- The service key provides backend access to manage documents

## Requirements

- Google Chrome or Microsoft Edge (Chromium-based)
- Active Turnitin account with login credentials
- Computer must remain on with browser open
- Stable internet connection

## Support

Need help? Contact support at: https://plagaiscans.lovable.app/contact`;

const AdminExtensionDownload: React.FC = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [iconBase64, setIconBase64] = useState<string | null>(null);

  // Load icon as base64 on mount
  React.useEffect(() => {
    fetch('/favicon.png')
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          setIconBase64(base64);
        };
        reader.readAsDataURL(blob);
      })
      .catch(console.error);
  }, []);

  const handleDownload = async () => {
    setIsDownloading(true);
    
    try {
      const zip = new JSZip();
      const extensionFolder = zip.folder('turnitin-extension');
      
      if (!extensionFolder) {
        throw new Error('Failed to create folder');
      }

      // Add all extension files
      extensionFolder.file('manifest.json', manifestJson);
      extensionFolder.file('background.js', backgroundJs);
      extensionFolder.file('content.js', contentJs);
      extensionFolder.file('popup.html', popupHtml);
      extensionFolder.file('popup.js', popupJs);
      extensionFolder.file('options.html', optionsHtml);
      extensionFolder.file('options.js', optionsJs);
      extensionFolder.file('README.md', readmeMd);

      // Add icons folder with the favicon
      const iconsFolder = extensionFolder.folder('icons');
      if (iconsFolder && iconBase64) {
        iconsFolder.file('icon16.png', iconBase64, { base64: true });
        iconsFolder.file('icon48.png', iconBase64, { base64: true });
        iconsFolder.file('icon128.png', iconBase64, { base64: true });
      }

      // Generate and download
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'turnitin-extension.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download Started',
        description: 'The extension ZIP file is downloading.',
      });
    } catch (error) {
      console.error('Error creating ZIP:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to create the extension ZIP file.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const installationSteps = [
    { step: 1, title: 'Extract the ZIP', description: 'Extract the downloaded ZIP file to a folder on your computer' },
    { step: 2, title: 'Open Extensions Page', description: 'Go to chrome://extensions/ (or edge://extensions/ for Edge)' },
    { step: 3, title: 'Enable Developer Mode', description: 'Toggle on Developer mode in the top right corner' },
    { step: 4, title: 'Load Unpacked', description: 'Click "Load unpacked" and select the extracted folder' },
    { step: 5, title: 'Configure', description: 'Click the extension icon, then configure your Turnitin credentials and paste your Extension Token' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Turnitin Automation Extension</h1>
          <p className="text-muted-foreground mt-1">
            Download and install the browser extension to automate document processing
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Download Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Chrome className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Browser Extension</CardTitle>
                  <CardDescription>Chrome & Edge compatible</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">v1.0.0</Badge>
                <Badge variant="outline">Manifest V3</Badge>
              </div>
              
              <p className="text-sm text-muted-foreground">
                This extension automatically processes pending documents through Turnitin and uploads 
                the reports back to your Plagaiscans dashboard.
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Auto-login to Turnitin</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Automatic file upload</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Report download & sync</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Real-time status updates</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleDownload}
                disabled={isDownloading || !iconBase64}
              >
                <Download className="h-4 w-4 mr-2" />
                {isDownloading ? 'Creating ZIP...' : 'Download Extension ZIP'}
              </Button>
            </CardContent>
          </Card>

          {/* Requirements Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <CardTitle>Requirements</CardTitle>
                  <CardDescription>Before you install</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <FileCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Active Turnitin Account</p>
                    <p className="text-xs text-muted-foreground">You need valid login credentials for Turnitin.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Chrome className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Chrome or Edge Browser</p>
                    <p className="text-xs text-muted-foreground">Chromium-based browsers only (no Firefox/Safari)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Extension Token</p>
                    <p className="text-xs text-muted-foreground">Generate a token below to use with the extension</p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> Your computer and browser must remain on for the extension to process documents automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Token Manager */}
        <ExtensionTokenManager />
        <Card>
          <CardHeader>
            <CardTitle>Installation Guide</CardTitle>
            <CardDescription>Follow these steps to install the extension</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {installationSteps.map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">{item.step}</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminExtensionDownload;
