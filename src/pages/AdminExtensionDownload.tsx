import React, { useState } from 'react';
import JSZip from 'jszip';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Chrome, Settings, FileCheck, AlertCircle, CheckCircle2, Key } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ExtensionTokenManager } from '@/components/ExtensionTokenManager';

// Extension file contents embedded as strings - Manifest V2 for Kiwi/mobile compatibility
const manifestJson = `{
  "manifest_version": 2,
  "name": "Plagaiscans Turnitin Automation",
  "version": "1.3.0",
  "description": "Automatically process documents through Turnitin and upload reports to Plagaiscans",
  "permissions": [
    "storage",
    "tabs",
    "downloads",
    "alarms",
    "notifications",
    "cookies",
    "https://*.turnitin.com/*",
    "https://nrtiedu.turnitin.com/*",
    "https://fyssbzgmhnolazjfwafm.supabase.co/*"
  ],
  "background": {
    "scripts": ["background.js"],
    "persistent": true
  },
  "content_scripts": [
    {
      "matches": ["https://*.turnitin.com/*", "https://nrtiedu.turnitin.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "browser_action": {
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

const backgroundJs = `// Plagaiscans Turnitin Automation - Background Script (MV2)
var SUPABASE_URL = 'https://fyssbzgmhnolazjfwafm.supabase.co';
var EXTENSION_API_URL = SUPABASE_URL + '/functions/v1/extension-api';
var DEFAULT_POLL_INTERVAL_MS = 10000;
var MAX_PROCESSING_TIME_MS = 30 * 60 * 1000;

var isProcessing = false;
var currentDocumentId = null;
var isEnabled = true;
var extensionToken = null;

// Initialize alarm immediately on script load (for Kiwi Browser compatibility)
// Note: Minimum alarm period is 1 minute in released extensions
chrome.alarms.get('pollDocuments', function(alarm) {
  if (!alarm) {
    chrome.alarms.create('pollDocuments', { periodInMinutes: 1 });
    console.log('Created pollDocuments alarm on script load');
  }
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('Plagaiscans Turnitin Automation installed');
  chrome.storage.local.set({ 
    isEnabled: true,
    processedCount: 0,
    lastError: null,
    currentStatus: 'idle'
  });
  chrome.alarms.create('pollDocuments', { periodInMinutes: 1 });
});

// Also create alarm on browser startup (for Kiwi Browser)
chrome.runtime.onStartup.addListener(function() {
  console.log('Extension started on browser startup');
  chrome.alarms.create('pollDocuments', { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === 'pollDocuments') {
    checkForPendingDocuments();
  }
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  handleMessage(message, sender, sendResponse);
  return true;
});

function handleMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'GET_STATUS':
      getStatus().then(function(status) { sendResponse(status); });
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
      console.log('Turnitin page ready');
      sendResponse({ acknowledged: true });
      break;
    case 'UPLOAD_COMPLETE':
      handleUploadComplete(message.data).then(function() { sendResponse({ success: true }); });
      break;
    case 'REPORTS_READY':
      handleReportsReady(message.data).then(function() { sendResponse({ success: true }); });
      break;
    case 'AUTOMATION_ERROR':
      handleAutomationError(message.error).then(function() { sendResponse({ acknowledged: true }); });
      break;
    case 'REQUEST_FILE':
      getFileForUpload().then(function(fileData) { sendResponse(fileData); });
      break;
    case 'GET_TURNITIN_SETTINGS':
      getTurnitinSettings().then(function(settings) { sendResponse(settings); });
      break;
    case 'START_PROCESSING_NOW':
      startProcessingNow().then(function(result) { sendResponse(result); });
      break;
    default:
      sendResponse({ error: 'Unknown message type' });
  }
}

function getStatus() {
  return new Promise(function(resolve) {
    chrome.storage.local.get([
      'isEnabled', 'processedCount', 'lastError', 'currentStatus',
      'currentDocumentName', 'turnitinCredentials', 'extensionToken', 'turnitinSettings',
      'authMethod', 'turnitinCookies'
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
    if (extensionToken) { resolve(extensionToken); return; }
    chrome.storage.local.get(['extensionToken'], function(data) {
      extensionToken = data.extensionToken;
      resolve(extensionToken);
    });
  });
}

function apiRequest(action, payload) {
  payload = payload || {};
  return getExtensionToken().then(function(token) {
    if (!token) throw new Error('Extension token not configured');
    return fetch(EXTENSION_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-extension-token': token },
      body: JSON.stringify(Object.assign({ action: action }, payload))
    });
  }).then(function(response) {
    if (!response.ok) {
      return response.json().catch(function() { return { error: 'Unknown error' }; }).then(function(error) {
        throw new Error(error.error || 'API error: ' + response.status);
      });
    }
    return response.json();
  });
}

function startProcessingNow() {
  if (isProcessing) return Promise.resolve({ success: false, message: 'Already processing' });
  return getExtensionToken().then(function(token) {
    if (!token) return { success: false, message: 'Extension token not configured' };
    return new Promise(function(resolve) {
      chrome.storage.local.get(['turnitinCredentials', 'authMethod', 'turnitinCookies'], function(data) {
        var hasCredentials = data.turnitinCredentials && data.turnitinCredentials.username;
        var hasCookies = data.authMethod === 'cookies' && data.turnitinCookies && data.turnitinCookies.length > 0;
        if (!hasCredentials && !hasCookies) {
          resolve({ success: false, message: 'Turnitin authentication not configured' });
          return;
        }
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
}

function checkForPendingDocuments() {
  if (!isEnabled || isProcessing) return;
  getExtensionToken().then(function(token) {
    if (!token) { console.log('No extension token configured, skipping poll'); return; }
    chrome.storage.local.get(['turnitinCredentials', 'authMethod', 'turnitinCookies'], function(data) {
      var hasCredentials = data.turnitinCredentials && data.turnitinCredentials.username;
      var hasCookies = data.authMethod === 'cookies' && data.turnitinCookies && data.turnitinCookies.length > 0;
      if (!hasCredentials && !hasCookies) {
        console.log('No Turnitin authentication configured, skipping poll');
        return;
      }
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
  chrome.storage.local.set({ currentStatus: 'processing', currentDocumentName: document.file_name });
  apiRequest('update_document_status', { documentId: document.id, automationStatus: 'processing' })
  .then(function() { return apiRequest('increment_attempt_count', { documentId: document.id }); })
  .then(function() { return apiRequest('log_automation', { documentId: document.id, logAction: 'processing_started', message: 'Started processing document' }); })
  .then(function() { chrome.storage.local.set({ currentStatus: 'downloading' }); return downloadFile(document.file_path); })
  .then(function(fileData) {
    chrome.storage.local.set({ currentFileData: fileData, currentFileName: document.file_name, currentFilePath: document.file_path, currentScanType: document.scan_type });
    return getTurnitinSettings();
  })
  .then(function(turnitinSettings) {
    chrome.storage.local.set({ currentStatus: 'opening_turnitin' });
    return injectCookiesIfNeeded().then(function() { return turnitinSettings; });
  })
  .then(function(turnitinSettings) {
    chrome.storage.local.get(['authMethod'], function(data) {
      var url = turnitinSettings.loginUrl;
      if (data.authMethod === 'cookies') {
        url = turnitinSettings.loginUrl.replace(/\\/$/, '') + '/home';
      }
      chrome.tabs.create({ url: url, active: false }, function(tab) {
        chrome.storage.local.set({ turnitinTabId: tab.id });
      });
    });
  })
  .catch(function(error) { console.error('Error processing document:', error); handleAutomationError(error.message); });
}

function injectCookiesIfNeeded() {
  return new Promise(function(resolve) {
    chrome.storage.local.get(['authMethod', 'turnitinCookies'], function(data) {
      if (data.authMethod !== 'cookies' || !data.turnitinCookies || data.turnitinCookies.length === 0) {
        resolve();
        return;
      }
      console.log('Injecting ' + data.turnitinCookies.length + ' cookies for Turnitin');
      var pending = data.turnitinCookies.length;
      data.turnitinCookies.forEach(function(cookie) {
        chrome.cookies.set({
          url: 'https://nrtiedu.turnitin.com',
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || '.turnitin.com',
          path: cookie.path || '/',
          secure: cookie.secure !== false,
          httpOnly: cookie.httpOnly || false,
          expirationDate: cookie.expirationDate
        }, function() {
          pending--;
          if (pending === 0) {
            console.log('Cookie injection complete');
            resolve();
          }
        });
      });
    });
  });
}

function downloadFile(filePath) {
  return apiRequest('get_signed_url', { bucketName: 'documents', filePath: filePath })
  .then(function(result) {
    if (!result.signedUrl) throw new Error('Failed to get signed URL');
    return fetch(result.signedUrl);
  })
  .then(function(fileResponse) {
    if (!fileResponse.ok) throw new Error('Failed to download file');
    return fileResponse.blob();
  })
  .then(function(blob) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function() {
        var base64 = reader.result.split(',')[1];
        resolve({ base64: base64, mimeType: blob.type, size: blob.size });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  });
}

function getFileForUpload() {
  return new Promise(function(resolve) {
    chrome.storage.local.get(['currentFileData', 'currentFileName'], function(data) {
      resolve({ fileData: data.currentFileData, fileName: data.currentFileName });
    });
  });
}

function handleUploadComplete(data) {
  console.log('Upload complete', data);
  chrome.storage.local.set({ currentStatus: 'waiting_for_results', turnitinSubmissionId: data.submissionId });
  return apiRequest('log_automation', { documentId: currentDocumentId, logAction: 'upload_complete', message: 'Document uploaded. Submission ID: ' + data.submissionId });
}

function handleReportsReady(data) {
  console.log('Reports ready', data);
  chrome.storage.local.set({ currentStatus: 'uploading_reports' });
  var promises = [];
  if (data.similarityReport) {
    var similarityPath = currentDocumentId + '/similarity_report.pdf';
    promises.push(apiRequest('upload_report', { fileData: data.similarityReport, fileName: 'similarity_report.pdf', bucketName: 'reports', filePath: similarityPath }));
  }
  if (data.aiReport) {
    var aiPath = currentDocumentId + '/ai_report.pdf';
    promises.push(apiRequest('upload_report', { fileData: data.aiReport, fileName: 'ai_report.pdf', bucketName: 'reports', filePath: aiPath }));
  }
  return Promise.all(promises)
  .then(function() {
    return apiRequest('complete_document', {
      documentId: currentDocumentId,
      similarityPercentage: data.similarityPercentage,
      aiPercentage: data.aiPercentage,
      similarityReportPath: data.similarityReport ? currentDocumentId + '/similarity_report.pdf' : null,
      aiReportPath: data.aiReport ? currentDocumentId + '/ai_report.pdf' : null
    });
  })
  .then(function() { return apiRequest('log_automation', { documentId: currentDocumentId, logAction: 'processing_complete', message: 'Similarity: ' + data.similarityPercentage + '%, AI: ' + (data.aiPercentage || 'N/A') + '%' }); })
  .then(function() {
    return new Promise(function(resolve) {
      chrome.storage.local.get(['processedCount'], function(storage) {
        chrome.storage.local.set({ processedCount: (storage.processedCount || 0) + 1, currentStatus: 'idle', lastProcessedAt: new Date().toISOString() }, resolve);
      });
    });
  })
  .then(function() {
    return new Promise(function(resolve) {
      chrome.storage.local.get(['turnitinTabId'], function(result) {
        if (result.turnitinTabId) { try { chrome.tabs.remove(result.turnitinTabId); } catch (e) {} }
        resolve();
      });
    });
  })
  .then(function() {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: 'Document Processed', message: (data.fileName || 'Document') + ' processed successfully' });
    isProcessing = false;
    currentDocumentId = null;
    chrome.storage.local.remove(['currentFileData', 'currentFileName', 'currentFilePath', 'currentScanType', 'turnitinTabId', 'turnitinSubmissionId']);
  })
  .catch(function(error) { console.error('Error handling reports:', error); return handleAutomationError(error.message); });
}

function handleAutomationError(errorMessage) {
  console.error('Automation error:', errorMessage);
  var promise = Promise.resolve();
  if (currentDocumentId) {
    promise = apiRequest('update_document_status', { documentId: currentDocumentId, automationStatus: 'failed', errorMessage: errorMessage })
    .then(function() { return apiRequest('log_automation', { documentId: currentDocumentId, logAction: 'processing_failed', message: errorMessage }); })
    .catch(function(e) { console.error('Failed to log error:', e); });
  }
  return promise.then(function() {
    chrome.storage.local.set({ currentStatus: 'error', lastError: errorMessage, lastErrorAt: new Date().toISOString() });
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: 'Automation Error', message: errorMessage.substring(0, 100) });
    isProcessing = false;
    currentDocumentId = null;
    return new Promise(function(resolve) {
      chrome.storage.local.get(['turnitinTabId'], function(result) {
        if (result.turnitinTabId) { try { chrome.tabs.remove(result.turnitinTabId); } catch (e) {} }
        chrome.storage.local.remove(['currentFileData', 'currentFileName', 'currentFilePath', 'currentScanType', 'turnitinTabId', 'turnitinSubmissionId'], resolve);
      });
    });
  });
}

function logError(action, message) { chrome.storage.local.set({ lastError: message }); }

checkForPendingDocuments();`;

const contentJs = `// Plagaiscans Turnitin Automation - Content Script
// Runs on Turnitin Originality (nrtiedu.turnitin.com) to automate upload and download

console.log('Plagaiscans Turnitin Automation content script loaded');

var isAutomating = false;
var currentStep = null;
var turnitinSettings = null;
var currentFileName = null;
var WAIT_TIMEOUT = 120000;
var CHECK_INTERVAL = 3000;
var ACTION_DELAY = 2000;
var REPORT_WAIT_TIME = 20 * 60 * 1000;

init();

function init() {
  log('Initializing content script...');
  chrome.storage.local.get(['turnitinSettings', 'currentFileName'], function(data) {
    turnitinSettings = data.turnitinSettings || {
      loginUrl: 'https://nrtiedu.turnitin.com/',
      folderName: 'Bio 2',
      autoLaunch: true,
      waitForAiReport: true
    };
    currentFileName = data.currentFileName;
    log('Settings loaded: folder=' + turnitinSettings.folderName);
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_DOCUMENT' }, function(response) {
      if (response && response.documentId) {
        log('Automation active for document: ' + response.documentId);
        isAutomating = true;
        chrome.runtime.sendMessage({ type: 'TURNITIN_READY' });
        wait(2000).then(function() { detectPageAndAct(); });
      } else {
        log('No active document, content script idle');
      }
    });
  });
}

function log(message) { console.log('[Plagaiscans] ' + message); }

function detectPageAndAct() {
  var url = window.location.href;
  log('Detecting page: ' + url);
  chrome.storage.local.get(['authMethod'], function(authData) {
    var usingCookies = authData.authMethod === 'cookies';
    try {
      if (isLoginPage()) {
        if (usingCookies) {
          log('Using cookie auth, redirecting to home...');
          var homeUrl = turnitinSettings.loginUrl.replace(/\\/$/, '') + '/home';
          window.location.href = homeUrl;
          return;
        }
        handleLoginPage();
        return;
      }
      hasLaunchButton().then(function(hasLaunch) {
        if (hasLaunch) { handleLaunchButton(); return; }
        if (isMyFilesPage()) { handleMyFilesPage(); return; }
        if (isReportViewer()) { handleReportViewer({}); return; }
        if (hasUploadModal()) { handleUploadModal(); return; }
        log('Unknown page, navigating to home...');
        window.location.href = turnitinSettings.loginUrl.replace(/\\/$/, '') + '/home';
      });
    } catch (error) {
      log('ERROR: ' + error.message);
      chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: error.message });
    }
  });
}

function isLoginPage() {
  var url = window.location.href.toLowerCase();
  if (url.includes('login') || url.includes('signin')) return true;
  var loginForm = document.querySelector('input[type="password"]');
  var loginButton = findElementByText(['log in', 'sign in', 'login'], 'button');
  return !!(loginForm || loginButton);
}

function hasLaunchButton() {
  return wait(1500).then(function() {
    var btn = findElementByText(['launch', 'launch automatically', 'launch originality'], 'button, a, [role="button"]');
    return !!btn;
  });
}

function isMyFilesPage() {
  var url = window.location.href.toLowerCase();
  if (url.includes('/home') || url.includes('/my-files') || url.includes('/files')) return true;
  var hasFileList = document.querySelector('table, [role="grid"], .file-list');
  var hasUploadBtn = findElementByText(['upload'], 'button, a');
  return !!(hasFileList && hasUploadBtn);
}

function isReportViewer() {
  var url = window.location.href.toLowerCase();
  return url.includes('/report') || url.includes('/viewer') || url.includes('/similarity');
}

function hasUploadModal() {
  var modal = document.querySelector('[role="dialog"], .modal');
  var fileInput = document.querySelector('input[type="file"]');
  return !!(modal && fileInput);
}

function handleLoginPage() {
  log('Step: Login page');
  currentStep = 'login';
  chrome.storage.local.get(['turnitinCredentials'], function(data) {
    var creds = data.turnitinCredentials;
    if (!creds || !creds.username || !creds.password) {
      chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: 'Turnitin credentials not configured' });
      return;
    }
    wait(2000).then(function() {
      var usernameInput = document.querySelector('input[name="username"]') || document.querySelector('#username') || document.querySelector('input[type="text"]:not([type="password"])');
      if (usernameInput) { simulateTyping(usernameInput, creds.username); log('Username entered'); }
      else { chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: 'Could not find username field' }); return; }
      wait(ACTION_DELAY).then(function() {
        var passwordInput = document.querySelector('input[type="password"]');
        if (passwordInput) { simulateTyping(passwordInput, creds.password); log('Password entered'); }
        else { chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: 'Could not find password field' }); return; }
        wait(ACTION_DELAY).then(function() {
          var loginBtn = findElementByText(['log in', 'sign in', 'login', 'submit'], 'button, input[type="submit"]');
          if (loginBtn) { loginBtn.click(); log('Login submitted'); waitForNavigation().then(function() { wait(3000).then(function() { detectPageAndAct(); }); }); }
          else { chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: 'Could not find login button' }); }
        });
      });
    });
  });
}

function handleLaunchButton() {
  log('Step: Launch button page');
  currentStep = 'launch';
  wait(2000).then(function() {
    var launchBtn = findElementByText(['launch', 'launch automatically', 'launch originality'], 'button, a, [role="button"]');
    if (launchBtn) { log('Clicking Launch button...'); launchBtn.click(); waitForNavigation().then(function() { wait(3000).then(function() { detectPageAndAct(); }); }); }
    else { log('No Launch button found, continuing...'); handleMyFilesPage(); }
  });
}

function handleMyFilesPage() {
  log('Step: My Files page');
  currentStep = 'my_files';
  wait(2000).then(function() {
    var isInTargetFolder = checkIfInFolder(turnitinSettings.folderName);
    if (!isInTargetFolder) { navigateToFolder(); return; }
    log('In target folder: ' + turnitinSettings.folderName);
    isDocumentAlreadyUploaded().then(function(uploaded) {
      if (uploaded) { log('Document already uploaded, checking for results...'); waitForReportsAndDownload(); return; }
      clickUploadButton();
    });
  });
}

function checkIfInFolder(folderName) {
  var breadcrumb = document.querySelector('[class*="breadcrumb"], .breadcrumb');
  if (breadcrumb && breadcrumb.textContent.toLowerCase().includes(folderName.toLowerCase())) return true;
  var header = document.querySelector('h1, h2, [class*="header"], [class*="title"]');
  if (header && header.textContent.toLowerCase().includes(folderName.toLowerCase())) return true;
  return false;
}

function navigateToFolder() {
  log('Looking for folder: ' + turnitinSettings.folderName);
  wait(2000).then(function() {
    var rows = document.querySelectorAll('tr, [role="row"], [class*="row"], [class*="folder"], [class*="item"]');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var text = row.textContent || '';
      if (text.toLowerCase().includes(turnitinSettings.folderName.toLowerCase())) {
        var hasFolder = row.querySelector('[class*="folder"], svg[data-icon*="folder"]') || row.innerHTML.toLowerCase().includes('folder');
        if (hasFolder || text.trim() === turnitinSettings.folderName) {
          log('Found folder row, clicking...');
          var clickable = row.querySelector('a, button, [role="button"]') || row;
          clickable.click();
          waitForNavigation().then(function() { wait(2000).then(function() { detectPageAndAct(); }); });
          return;
        }
      }
    }
    var folderLink = findElementByText([turnitinSettings.folderName], 'a, button, [role="button"]');
    if (folderLink) { log('Found folder link, clicking...'); folderLink.click(); waitForNavigation().then(function() { wait(2000).then(function() { detectPageAndAct(); }); }); return; }
    chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: 'Could not find folder: ' + turnitinSettings.folderName });
  });
}

function isDocumentAlreadyUploaded() {
  return new Promise(function(resolve) {
    if (!currentFileName) { resolve(false); return; }
    var cleanName = currentFileName.replace(/\\.[^.]+$/, '').toLowerCase();
    var pageText = document.body.textContent.toLowerCase();
    resolve(pageText.includes(cleanName));
  });
}

function clickUploadButton() {
  log('Looking for Upload button...');
  var uploadBtn = findElementByText(['upload'], 'button, a, [role="button"]');
  if (uploadBtn) {
    log('Clicking Upload button...');
    uploadBtn.click();
    wait(2000).then(function() {
      if (hasUploadModal()) { handleUploadModal(); }
      else { detectPageAndAct(); }
    });
  } else { chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: 'Could not find Upload button' }); }
}

function handleUploadModal() {
  log('Step: Upload modal');
  currentStep = 'upload';
  wait(2000).then(function() {
    chrome.runtime.sendMessage({ type: 'REQUEST_FILE' }, function(fileInfo) {
      if (!fileInfo || !fileInfo.fileData) { chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: 'No file data received' }); return; }
      log('Got file: ' + fileInfo.fileName);
      var byteCharacters = atob(fileInfo.fileData.base64);
      var byteNumbers = new Array(byteCharacters.length);
      for (var i = 0; i < byteCharacters.length; i++) { byteNumbers[i] = byteCharacters.charCodeAt(i); }
      var byteArray = new Uint8Array(byteNumbers);
      var blob = new Blob([byteArray], { type: fileInfo.fileData.mimeType || 'application/octet-stream' });
      var file = new File([blob], fileInfo.fileName, { type: blob.type });
      var fileInput = document.querySelector('input[type="file"]');
      if (!fileInput) { waitForElement('input[type="file"]').then(function(input) { if (input) { attachFile(input, file, fileInfo); } else { chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: 'Could not find file input' }); } }); return; }
      attachFile(fileInput, file, fileInfo);
    });
  });
}

function attachFile(fileInput, file, fileInfo) {
  var dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  log('File attached');
  wait(ACTION_DELAY).then(function() {
    var titleInput = document.querySelector('input[name="title"], input[placeholder*="title" i], #title');
    if (titleInput) { var title = fileInfo.fileName.replace(/\\.[^.]+$/, ''); simulateTyping(titleInput, title); log('Title entered'); }
    wait(ACTION_DELAY).then(function() {
      var submitBtn = findElementByText(['upload', 'submit', 'confirm', 'add'], 'button, input[type="submit"]');
      if (submitBtn) {
        log('Clicking submit button...');
        submitBtn.click();
        wait(3000).then(function() {
          chrome.runtime.sendMessage({ type: 'UPLOAD_COMPLETE', data: { submissionId: 'pending', fileName: fileInfo.fileName } });
          wait(5000).then(function() { window.location.reload(); });
        });
      } else { chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: 'Could not find submit button' }); }
    });
  });
}

function waitForReportsAndDownload() {
  log('Step: Waiting for reports');
  currentStep = 'waiting_reports';
  var startTime = Date.now();
  var checkCount = 0;
  function checkReports() {
    checkCount++;
    log('Checking for reports... (attempt ' + checkCount + ')');
    wait(CHECK_INTERVAL).then(function() {
      var docRow = findDocumentRow();
      if (docRow) {
        var scores = extractScoresFromRow(docRow);
        if (scores.similarityReady) {
          log('Reports ready! Similarity: ' + scores.similarity + '%');
          openDocumentAndDownload(docRow, scores);
          return;
        }
      }
      if (Date.now() - startTime >= REPORT_WAIT_TIME) { chrome.runtime.sendMessage({ type: 'AUTOMATION_ERROR', error: 'Timeout waiting for reports' }); return; }
      if (checkCount % 20 === 0) { log('Refreshing page...'); window.location.reload(); return; }
      setTimeout(checkReports, CHECK_INTERVAL);
    });
  }
  checkReports();
}

function findDocumentRow() {
  if (!currentFileName) return null;
  var cleanName = currentFileName.replace(/\\.[^.]+$/, '').toLowerCase();
  var rows = document.querySelectorAll('tr, [role="row"], [class*="row"]');
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var text = (row.textContent || '').toLowerCase();
    if (text.includes(cleanName)) return row;
  }
  return null;
}

function extractScoresFromRow(row) {
  var result = { similarity: null, ai: null, similarityReady: false };
  var text = row.textContent || '';
  var percentMatches = text.match(/(\\d+)\\s*%/g);
  if (percentMatches && percentMatches.length > 0) {
    var simMatch = percentMatches[0].match(/(\\d+)/);
    if (simMatch) { result.similarity = parseInt(simMatch[1]); result.similarityReady = true; }
    if (percentMatches.length > 1) { var aiMatch = percentMatches[1].match(/(\\d+)/); if (aiMatch) result.ai = parseInt(aiMatch[1]); }
  }
  if (text.includes('processing') || text.includes('pending') || text.includes('*%')) result.similarityReady = false;
  return result;
}

function openDocumentAndDownload(row, scores) {
  log('Step: Opening document and downloading reports');
  currentStep = 'downloading';
  var similarityLink = row.querySelector('[class*="similarity"], [class*="score"] a, a[href*="report"]');
  if (!similarityLink) {
    var cells = row.querySelectorAll('td, [class*="cell"]');
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.textContent && cell.textContent.match(/\\d+\\s*%/)) {
        var clickable = cell.querySelector('a, button') || cell;
        similarityLink = clickable;
        break;
      }
    }
  }
  if (similarityLink) { log('Clicking to open report viewer...'); similarityLink.click(); wait(3000).then(function() { handleReportViewer(scores); }); }
  else { log('Could not find report link, completing with scores only'); completeWithScores(scores); }
}

function handleReportViewer(scores) {
  log('Step: Report viewer');
  currentStep = 'report_viewer';
  scores = scores || {};
  wait(3000).then(function() {
    var reports = { similarityReport: null, aiReport: null, similarityPercentage: scores.similarity || null, aiPercentage: scores.ai || null };
    if (!reports.similarityPercentage) {
      var scoreElem = document.querySelector('[class*="score"], [class*="percent"], [class*="similarity"]');
      if (scoreElem) { var match = scoreElem.textContent.match(/(\\d+)/); if (match) reports.similarityPercentage = parseInt(match[1]); }
    }
    var downloadArrow = document.querySelector('[class*="download"], [aria-label*="download"]');
    if (!downloadArrow) {
      var buttons = document.querySelectorAll('button, [role="button"]');
      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        var html = btn.innerHTML.toLowerCase();
        if (html.includes('download') || html.includes('arrow')) { downloadArrow = btn; break; }
      }
    }
    if (downloadArrow) {
      log('Found download arrow, clicking...');
      downloadArrow.click();
      wait(1500).then(function() {
        var similarityOption = findElementByText(['similarity', 'originality'], '[role="menuitem"], a, button');
        if (similarityOption) { log('Downloading similarity report...'); similarityOption.click(); }
        wait(3000).then(function() {
          downloadArrow.click();
          wait(1500).then(function() {
            var aiOption = findElementByText(['ai', 'writing'], '[role="menuitem"], a, button');
            if (aiOption) { log('Downloading AI report...'); aiOption.click(); }
            wait(3000).then(function() { completeWithScores(reports); });
          });
        });
      });
    } else { log('No download arrow found'); completeWithScores(reports); }
  });
}

function completeWithScores(scores) {
  log('Completing document with scores');
  var reports = { similarityReport: null, aiReport: null, similarityPercentage: scores.similarity || scores.similarityPercentage || null, aiPercentage: scores.ai || scores.aiPercentage || null, fileName: currentFileName };
  log('Final scores - Similarity: ' + reports.similarityPercentage + '%, AI: ' + reports.aiPercentage + '%');
  chrome.runtime.sendMessage({ type: 'REPORTS_READY', data: reports });
}

function wait(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

function findElementByText(textArray, selector) {
  var elements = document.querySelectorAll(selector || '*');
  for (var i = 0; i < elements.length; i++) {
    var elem = elements[i];
    var text = (elem.textContent || '').toLowerCase().trim();
    for (var j = 0; j < textArray.length; j++) {
      if (text.includes(textArray[j].toLowerCase())) return elem;
    }
  }
  return null;
}

function waitForElement(selector, timeout) {
  timeout = timeout || WAIT_TIMEOUT;
  return new Promise(function(resolve) {
    var startTime = Date.now();
    function check() {
      var element = document.querySelector(selector);
      if (element) { resolve(element); return; }
      if (Date.now() - startTime >= timeout) { resolve(null); return; }
      setTimeout(check, 500);
    }
    check();
  });
}

function waitForNavigation() {
  var currentUrl = window.location.href;
  return new Promise(function(resolve) {
    var startTime = Date.now();
    function check() {
      if (window.location.href !== currentUrl) { wait(2000).then(resolve); return; }
      if (Date.now() - startTime >= WAIT_TIMEOUT) { resolve(); return; }
      setTimeout(check, 500);
    }
    check();
  });
}

function simulateTyping(element, text) {
  element.focus();
  element.value = '';
  var i = 0;
  function typeChar() {
    if (i >= text.length) { element.dispatchEvent(new Event('change', { bubbles: true })); return; }
    element.value += text[i];
    element.dispatchEvent(new Event('input', { bubbles: true }));
    i++;
    setTimeout(typeChar, 30 + Math.random() * 30);
  }
  typeChar();
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'START_AUTOMATION') { isAutomating = true; detectPageAndAct(); sendResponse({ started: true }); }
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
    .actions { display: flex; gap: 8px; margin-bottom: 12px; }
    .btn { flex: 1; padding: 10px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-primary:disabled { background: #3b82f680; cursor: not-allowed; }
    .btn-secondary { background: rgba(255,255,255,0.1); color: #e4e4e7; }
    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
    .btn-success { background: #22c55e; color: white; }
    .btn-success:hover { background: #16a34a; }
    .btn-success:disabled { background: #22c55e80; cursor: not-allowed; }
    .start-now-container { margin-bottom: 12px; }
    .start-now-btn { width: 100%; padding: 14px 16px; font-size: 14px; }
    .start-now-message { font-size: 12px; text-align: center; margin-top: 8px; padding: 8px; border-radius: 6px; }
    .start-now-message.success { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
    .start-now-message.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
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
  <div class="start-now-container"><button class="btn btn-success start-now-btn" id="startNowBtn">▶ Start Processing Now</button><div id="startNowMessage" class="start-now-message" style="display: none;"></div></div>
  <div id="currentDocContainer" class="current-doc" style="display: none;"><div class="current-doc-title">Currently Processing</div><div class="current-doc-name" id="currentDocName"></div><div class="current-doc-status" id="currentDocStatus"></div></div>
  <div id="errorContainer" class="error-card" style="display: none;"><div class="error-title">Last Error</div><div class="error-message" id="errorMessage"></div></div>
  <div id="noCredsContainer" class="no-creds" style="display: none;"><p>⚠️ Turnitin credentials not configured</p><button class="btn btn-primary" id="setupBtn">Set Up Credentials</button></div>
  <div class="actions"><button class="btn btn-secondary" id="settingsBtn">Settings</button><button class="btn btn-primary" id="refreshBtn">Refresh</button></div>
  <div class="footer"><a href="https://plagaiscans.lovable.app" target="_blank">Open Plagaiscans Dashboard →</a></div>
  <script src="popup.js"></script>
</body>
</html>`;

const popupJs = `document.addEventListener('DOMContentLoaded', init);

function init() {
  testBackgroundConnection();
  setupEventListeners();
  setInterval(updateStatus, 3000);
}

function testBackgroundConnection() {
  try {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, function(status) {
      if (chrome.runtime.lastError) {
        console.error('Background inactive:', chrome.runtime.lastError);
        showBackgroundInactiveState();
        wakeUpBackground();
      } else if (status) {
        updateStatusUI(status);
      } else {
        showBackgroundInactiveState();
      }
    });
  } catch (e) {
    console.error('Exception testing background:', e);
    showBackgroundInactiveState();
  }
}

function wakeUpBackground() {
  try {
    chrome.runtime.getBackgroundPage(function(bg) {
      if (bg) {
        console.log('Background page accessed, creating alarm');
        chrome.alarms.create('pollDocuments', { periodInMinutes: 1 });
        setTimeout(function() { updateStatus(); }, 500);
      } else {
        console.log('Could not access background page');
      }
    });
  } catch (e) {
    console.error('Error waking background:', e);
  }
}

function showBackgroundInactiveState() {
  var statusDot = document.getElementById('statusDot');
  var statusText = document.getElementById('statusText');
  var connectionStatus = document.getElementById('connectionStatus');
  var startNowBtn = document.getElementById('startNowBtn');
  var errorContainer = document.getElementById('errorContainer');
  var errorMessage = document.getElementById('errorMessage');
  
  if (statusDot) statusDot.className = 'status-dot error';
  if (statusText) statusText.textContent = 'Background Inactive';
  if (connectionStatus) { connectionStatus.textContent = 'Tap Refresh to wake up'; connectionStatus.style.color = '#ef4444'; }
  if (startNowBtn) { startNowBtn.disabled = true; startNowBtn.textContent = 'Background Inactive'; }
  if (errorContainer && errorMessage) { errorContainer.style.display = 'block'; errorMessage.textContent = 'Background script is sleeping. Tap Refresh to wake it up.'; }
}

function updateStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, function(status) {
    if (chrome.runtime.lastError) { console.error('Error getting status:', chrome.runtime.lastError); showBackgroundInactiveState(); return; }
    if (!status) { showBackgroundInactiveState(); return; }
    updateStatusUI(status);
  });
}

function updateStatusUI(status) {
  var toggle = document.getElementById('enableToggle');
  if (toggle) toggle.checked = status.isEnabled;
  var statusDot = document.getElementById('statusDot');
  var statusText = document.getElementById('statusText');
  if (statusDot) {
    statusDot.className = 'status-dot';
    if (status.lastError && status.currentStatus === 'error') statusDot.classList.add('error');
    else if (status.isProcessing) statusDot.classList.add('processing');
    else if (status.isEnabled) statusDot.classList.add('success');
    else statusDot.classList.add('idle');
  }
  if (statusText) {
    if (status.lastError && status.currentStatus === 'error') statusText.textContent = 'Error';
    else if (status.isProcessing) statusText.textContent = formatStatus(status.currentStatus);
    else if (status.isEnabled) statusText.textContent = 'Ready';
    else statusText.textContent = 'Disabled';
  }
  var connectionStatus = document.getElementById('connectionStatus');
  var hasAuth = status.hasCredentials || status.hasCookies;
  if (connectionStatus) { connectionStatus.textContent = hasAuth ? (status.authMethod === 'cookies' ? 'Cookies' : 'Credentials') : 'Not configured'; connectionStatus.style.color = hasAuth ? '#22c55e' : '#fbbf24'; }
  var processedCountEl = document.getElementById('processedCount');
  if (processedCountEl) processedCountEl.textContent = status.processedCount || 0;
  var startNowBtn = document.getElementById('startNowBtn');
  if (startNowBtn) {
    if (status.isProcessing) { startNowBtn.disabled = true; startNowBtn.textContent = 'Processing...'; }
    else if (!hasAuth || !status.hasToken) { startNowBtn.disabled = true; startNowBtn.textContent = '▶ Start Processing Now'; }
    else { startNowBtn.disabled = false; startNowBtn.textContent = '▶ Start Processing Now'; }
  }
  var currentDocContainer = document.getElementById('currentDocContainer');
  if (currentDocContainer) {
    if (status.isProcessing && status.currentDocumentName) {
      currentDocContainer.style.display = 'block';
      var docNameEl = document.getElementById('currentDocName');
      var docStatusEl = document.getElementById('currentDocStatus');
      if (docNameEl) docNameEl.textContent = status.currentDocumentName;
      if (docStatusEl) docStatusEl.textContent = formatStatus(status.currentStatus);
    } else { currentDocContainer.style.display = 'none'; }
  }
  var errorContainer = document.getElementById('errorContainer');
  if (errorContainer) {
    var errorMessage = document.getElementById('errorMessage');
    if (status.lastError && !status.isProcessing) { errorContainer.style.display = 'block'; if (errorMessage) errorMessage.textContent = status.lastError; }
    else { errorContainer.style.display = 'none'; }
  }
  var noCredsContainer = document.getElementById('noCredsContainer');
  if (noCredsContainer) noCredsContainer.style.display = hasAuth ? 'none' : 'block';
}

function formatStatus(status) {
  var statusMap = { 'idle': 'Idle', 'processing': 'Processing...', 'downloading': 'Downloading file...', 'opening_turnitin': 'Opening Turnitin...', 'waiting_for_results': 'Waiting for results...', 'uploading_reports': 'Uploading reports...', 'error': 'Error' };
  return statusMap[status] || status;
}

function setupEventListeners() {
  var enableToggle = document.getElementById('enableToggle');
  if (enableToggle) enableToggle.addEventListener('change', function(e) { chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED', enabled: e.target.checked }, function() { updateStatus(); }); });
  var startNowBtn = document.getElementById('startNowBtn');
  if (startNowBtn) {
    startNowBtn.addEventListener('click', function() {
      var btn = document.getElementById('startNowBtn');
      btn.disabled = true;
      btn.textContent = 'Starting...';
      chrome.runtime.sendMessage({ type: 'START_PROCESSING_NOW' }, function(result) {
        if (chrome.runtime.lastError) { showStartNowMessage('Error: ' + chrome.runtime.lastError.message, 'error'); btn.disabled = false; btn.textContent = '▶ Start Processing Now'; return; }
        if (result && result.success) { showStartNowMessage(result.message, 'success'); }
        else { showStartNowMessage(result ? result.message : 'Unknown error', 'error'); btn.disabled = false; btn.textContent = '▶ Start Processing Now'; }
        updateStatus();
      });
    });
  }
  var settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', function() { chrome.runtime.openOptionsPage(); });
  var setupBtn = document.getElementById('setupBtn');
  if (setupBtn) setupBtn.addEventListener('click', function() { chrome.runtime.openOptionsPage(); });
  var refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', function() { wakeUpBackground(); });
}

function showStartNowMessage(message, type) {
  var messageEl = document.getElementById('startNowMessage');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.className = 'start-now-message ' + type;
    messageEl.style.display = 'block';
    setTimeout(function() { messageEl.style.display = 'none'; }, 5000);
  }
}`;

const optionsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extension Settings - Plagaiscans</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); min-height: 100vh; color: #e4e4e7; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { font-size: 28px; margin-bottom: 8px; color: #fff; }
    .subtitle { color: #a1a1aa; margin-bottom: 24px; }
    .section { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #fff; display: flex; align-items: center; gap: 8px; }
    .section-title::before { content: ''; width: 4px; height: 20px; background: #3b82f6; border-radius: 2px; }
    .form-group { margin-bottom: 16px; }
    .form-group:last-child { margin-bottom: 0; }
    label { display: block; font-size: 13px; color: #a1a1aa; margin-bottom: 6px; }
    input[type="text"], input[type="password"], input[type="url"], input[type="number"], textarea { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 14px; transition: border-color 0.2s; }
    textarea { min-height: 100px; resize: vertical; font-family: monospace; font-size: 12px; }
    input:focus, textarea:focus { outline: none; border-color: #3b82f6; }
    input::placeholder, textarea::placeholder { color: #71717a; }
    .checkbox-group { display: flex; align-items: center; gap: 10px; padding: 12px 0; }
    .checkbox-group input[type="checkbox"] { width: 18px; height: 18px; accent-color: #3b82f6; }
    .checkbox-group label { margin-bottom: 0; color: #e4e4e7; cursor: pointer; }
    .checkbox-hint { font-size: 11px; color: #71717a; margin-left: 28px; margin-top: -8px; }
    .radio-group { display: flex; gap: 20px; margin-bottom: 16px; }
    .radio-option { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .radio-option input[type="radio"] { width: 18px; height: 18px; accent-color: #3b82f6; }
    .radio-option label { margin-bottom: 0; cursor: pointer; color: #e4e4e7; }
    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-secondary { background: rgba(255,255,255,0.1); color: #e4e4e7; }
    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
    .btn-danger { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
    .btn-danger:hover { background: rgba(239, 68, 68, 0.3); }
    .btn-group { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
    .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .status-badge.warning { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
    .status-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .success-message { color: #22c55e; font-size: 13px; margin-top: 8px; display: none; }
    .error-message { color: #ef4444; font-size: 13px; margin-top: 8px; display: none; }
    .input-hint { font-size: 11px; color: #71717a; margin-top: 4px; }
    .divider { height: 1px; background: rgba(255,255,255,0.1); margin: 20px 0; }
    .info-box { background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 12px; color: #93c5fd; }
    .auth-section { display: none; }
    .auth-section.active { display: block; }
    .cookie-info { font-size: 11px; color: #71717a; margin-top: 6px; display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Extension Settings</h1>
    <p class="subtitle">Configure your Turnitin automation preferences</p>
    <div class="section">
      <div class="section-title">Turnitin Settings</div>
      <form id="turnitinSettingsForm">
        <div class="form-group">
          <label for="turnitinUrl">Turnitin Login URL</label>
          <input type="url" id="turnitinUrl" placeholder="https://nrtiedu.turnitin.com/">
          <div class="input-hint">Your institution's Turnitin portal URL</div>
        </div>
        <div class="form-group">
          <label for="folderName">Target Folder/Class Name</label>
          <input type="text" id="folderName" placeholder="Bio 2">
          <div class="input-hint">The folder or class to navigate to for submissions</div>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="autoLaunch" checked>
          <label for="autoLaunch">Click "Launch automatically" button</label>
        </div>
        <div class="checkbox-hint">Enable if your Turnitin has a "Launch automatically" or "Launch Originality" button</div>
        <div class="checkbox-group">
          <input type="checkbox" id="waitForAiReport" checked>
          <label for="waitForAiReport">Wait for AI report</label>
        </div>
        <div class="checkbox-hint">Wait for AI detection results in addition to similarity report</div>
        <div class="btn-group"><button type="submit" class="btn btn-primary">Save Turnitin Settings</button></div>
        <div id="turnitinSettingsSuccess" class="success-message"></div>
        <div id="turnitinSettingsError" class="error-message"></div>
      </form>
    </div>
    <div class="section">
      <div class="section-title">Authentication Method</div>
      <div class="radio-group">
        <div class="radio-option">
          <input type="radio" id="authMethodCredentials" name="authMethod" value="credentials" checked>
          <label for="authMethodCredentials">Use Credentials</label>
        </div>
        <div class="radio-option">
          <input type="radio" id="authMethodCookies" name="authMethod" value="cookies">
          <label for="authMethodCookies">Use Cookies</label>
        </div>
      </div>
      <div id="credentialsSection" class="auth-section active">
        <div class="info-box">🔒 Your credentials are stored locally and never sent to our servers.</div>
        <form id="turnitinForm">
          <div class="form-group">
            <label for="turnitinUsername">Username</label>
            <input type="text" id="turnitinUsername" placeholder="your_username">
          </div>
          <div class="form-group">
            <label for="turnitinPassword">Password</label>
            <input type="password" id="turnitinPassword" placeholder="Leave blank to keep existing">
          </div>
          <div class="btn-group">
            <button type="submit" class="btn btn-primary">Save Credentials</button>
            <button type="button" class="btn btn-danger" id="clearCredsBtn">Clear</button>
          </div>
          <div id="credSuccess" class="success-message"></div>
          <div id="credError" class="error-message"></div>
        </form>
        <div style="margin-top: 12px;"><span class="status-badge warning" id="credStatus"><span class="dot"></span>Not configured</span></div>
      </div>
      <div id="cookiesSection" class="auth-section">
        <div class="info-box">🍪 Import session cookies from a logged-in browser. Useful when credentials don't work (MFA, CAPTCHA).</div>
        <form id="cookieForm">
          <div class="form-group">
            <label for="cookieData">Cookie Data (JSON, Netscape, or key=value format)</label>
            <textarea id="cookieData" placeholder='[{"name": "session_id", "value": "abc123", "domain": ".turnitin.com"}]

Or simple format:
session_id=abc123
auth_token=xyz789'></textarea>
            <div class="input-hint">Paste cookies from browser DevTools or export tools</div>
            <div class="cookie-info" id="cookieInfo"></div>
          </div>
          <div class="btn-group">
            <button type="submit" class="btn btn-primary">Import Cookies</button>
            <button type="button" class="btn btn-secondary" id="exportCookiesBtn">Export Current</button>
            <button type="button" class="btn btn-secondary" id="testCookiesBtn">Test</button>
            <button type="button" class="btn btn-danger" id="clearCookiesBtn">Clear</button>
          </div>
          <div id="cookieSuccess" class="success-message"></div>
          <div id="cookieError" class="error-message"></div>
        </form>
        <div style="margin-top: 12px;"><span class="status-badge warning" id="cookieStatus"><span class="dot"></span>Not configured</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Extension Token</div>
      <form id="tokenForm">
        <div class="form-group">
          <label for="extensionToken">API Token</label>
          <input type="text" id="extensionToken" placeholder="ext_xxxxxxxxxxxx...">
          <div class="input-hint">Get this from your Plagaiscans admin dashboard</div>
        </div>
        <div class="btn-group">
          <button type="submit" class="btn btn-primary">Save & Verify Token</button>
          <button type="button" class="btn btn-danger" id="clearTokenBtn">Clear</button>
        </div>
        <div id="tokenSuccess" class="success-message"></div>
        <div id="tokenError" class="error-message"></div>
      </form>
    </div>
    <div class="section">
      <div class="section-title">Advanced Settings</div>
      <div class="form-group">
        <label for="pollInterval">Poll Interval (seconds)</label>
        <input type="number" id="pollInterval" value="10" min="5" max="60">
        <div class="input-hint">How often to check for new documents (5-60 seconds)</div>
      </div>
      <div class="form-group">
        <label for="maxRetries">Max Retries</label>
        <input type="number" id="maxRetries" value="3" min="1" max="10">
        <div class="input-hint">Maximum retry attempts for failed documents</div>
      </div>
      <div class="form-group">
        <label for="reportWaitTime">Report Wait Time (minutes)</label>
        <input type="number" id="reportWaitTime" value="20" min="5" max="60">
        <div class="input-hint">Maximum time to wait for reports to be ready</div>
      </div>
      <div class="btn-group"><button type="button" class="btn btn-primary" id="saveAdvancedBtn">Save Advanced Settings</button></div>
      <div id="advancedSuccess" class="success-message"></div>
    </div>
  </div>
  <script src="options.js"></script>
</body>
</html>`;

const optionsJs = `document.addEventListener('DOMContentLoaded', init);

function init() { loadSavedSettings(); setupEventListeners(); }

function loadSavedSettings() {
  chrome.storage.local.get(['turnitinCredentials', 'extensionToken', 'turnitinSettings', 'pollInterval', 'maxRetries', 'reportWaitTime', 'authMethod', 'turnitinCookies', 'cookiesImportedAt'], function(data) {
    if (data.turnitinCredentials && data.turnitinCredentials.username) {
      document.getElementById('turnitinUsername').value = data.turnitinCredentials.username;
      document.getElementById('turnitinPassword').placeholder = '••••••••';
      document.getElementById('credStatus').className = 'status-badge';
      document.getElementById('credStatus').innerHTML = '<span class="dot"></span>Configured';
    }
    if (data.extensionToken) {
      document.getElementById('extensionToken').placeholder = '••• Token saved •••';
    }
    var authMethod = data.authMethod || 'credentials';
    document.getElementById('authMethodCredentials').checked = authMethod === 'credentials';
    document.getElementById('authMethodCookies').checked = authMethod === 'cookies';
    updateAuthMethodUI(authMethod);
    updateCookieStatus(data.turnitinCookies, data.cookiesImportedAt);
    if (data.turnitinSettings) {
      document.getElementById('turnitinUrl').value = data.turnitinSettings.loginUrl || '';
      document.getElementById('folderName').value = data.turnitinSettings.folderName || '';
      document.getElementById('autoLaunch').checked = data.turnitinSettings.autoLaunch !== false;
      document.getElementById('waitForAiReport').checked = data.turnitinSettings.waitForAiReport !== false;
    }
    if (data.pollInterval) document.getElementById('pollInterval').value = data.pollInterval;
    if (data.maxRetries) document.getElementById('maxRetries').value = data.maxRetries;
    if (data.reportWaitTime) document.getElementById('reportWaitTime').value = data.reportWaitTime;
  });
}

function updateAuthMethodUI(method) {
  var credentialsSection = document.getElementById('credentialsSection');
  var cookiesSection = document.getElementById('cookiesSection');
  if (method === 'cookies') {
    credentialsSection.className = 'auth-section';
    cookiesSection.className = 'auth-section active';
  } else {
    credentialsSection.className = 'auth-section active';
    cookiesSection.className = 'auth-section';
  }
}

function updateCookieStatus(cookies, importedAt) {
  var cookieStatus = document.getElementById('cookieStatus');
  if (cookies && cookies.length > 0) {
    var importDate = importedAt ? new Date(importedAt).toLocaleString() : 'Unknown';
    var now = Date.now() / 1000;
    var expiredCookies = cookies.filter(function(c) { return c.expirationDate && c.expirationDate < now; });
    if (expiredCookies.length > 0) {
      cookieStatus.className = 'status-badge warning';
      cookieStatus.innerHTML = '<span class="dot"></span>' + expiredCookies.length + ' expired cookies';
    } else {
      cookieStatus.className = 'status-badge';
      cookieStatus.innerHTML = '<span class="dot"></span>' + cookies.length + ' cookies saved';
    }
    document.getElementById('cookieInfo').textContent = 'Imported: ' + importDate;
    document.getElementById('cookieInfo').style.display = 'block';
  } else {
    cookieStatus.className = 'status-badge warning';
    cookieStatus.innerHTML = '<span class="dot"></span>Not configured';
    document.getElementById('cookieInfo').style.display = 'none';
  }
}

function setupEventListeners() {
  document.getElementById('authMethodCredentials').addEventListener('change', function() {
    if (this.checked) { chrome.storage.local.set({ authMethod: 'credentials' }); updateAuthMethodUI('credentials'); }
  });
  document.getElementById('authMethodCookies').addEventListener('change', function() {
    if (this.checked) { chrome.storage.local.set({ authMethod: 'cookies' }); updateAuthMethodUI('cookies'); }
  });
  document.getElementById('turnitinSettingsForm').addEventListener('submit', function(e) { e.preventDefault(); saveTurnitinSettings(); });
  document.getElementById('turnitinForm').addEventListener('submit', function(e) { e.preventDefault(); saveTurnitinCredentials(); });
  document.getElementById('clearCredsBtn').addEventListener('click', function() {
    chrome.storage.local.remove(['turnitinCredentials'], function() {
      document.getElementById('turnitinUsername').value = '';
      document.getElementById('turnitinPassword').value = '';
      document.getElementById('credStatus').className = 'status-badge warning';
      document.getElementById('credStatus').innerHTML = '<span class="dot"></span>Not configured';
      showMessage('credSuccess', 'Credentials cleared');
    });
  });
  document.getElementById('cookieForm').addEventListener('submit', function(e) { e.preventDefault(); importCookies(); });
  document.getElementById('exportCookiesBtn').addEventListener('click', exportCurrentCookies);
  document.getElementById('testCookiesBtn').addEventListener('click', testCookies);
  document.getElementById('clearCookiesBtn').addEventListener('click', function() {
    chrome.storage.local.remove(['turnitinCookies', 'cookiesImportedAt'], function() {
      document.getElementById('cookieData').value = '';
      updateCookieStatus(null, null);
      showMessage('cookieSuccess', 'Cookies cleared');
    });
  });
  document.getElementById('tokenForm').addEventListener('submit', function(e) { e.preventDefault(); saveExtensionToken(); });
  document.getElementById('clearTokenBtn').addEventListener('click', function() {
    chrome.storage.local.remove(['extensionToken'], function() {
      document.getElementById('extensionToken').value = '';
      document.getElementById('extensionToken').placeholder = 'ext_xxxxxxxxxxxx...';
      showMessage('tokenSuccess', 'Token cleared');
    });
  });
  document.getElementById('saveAdvancedBtn').addEventListener('click', saveAdvancedSettings);
}

function saveTurnitinSettings() {
  var loginUrl = document.getElementById('turnitinUrl').value.trim() || 'https://nrtiedu.turnitin.com/';
  var folderName = document.getElementById('folderName').value.trim() || 'Bio 2';
  var autoLaunch = document.getElementById('autoLaunch').checked;
  var waitForAiReport = document.getElementById('waitForAiReport').checked;
  try { new URL(loginUrl); } catch (e) { showError('turnitinSettingsError', 'Please enter a valid URL'); return; }
  chrome.storage.local.set({ turnitinSettings: { loginUrl: loginUrl, folderName: folderName, autoLaunch: autoLaunch, waitForAiReport: waitForAiReport } }, function() {
    showMessage('turnitinSettingsSuccess', 'Turnitin settings saved');
  });
}

function saveTurnitinCredentials() {
  var username = document.getElementById('turnitinUsername').value.trim();
  var password = document.getElementById('turnitinPassword').value;
  if (!username) { showError('credError', 'Please enter username'); return; }
  chrome.storage.local.get(['turnitinCredentials'], function(existing) {
    var savedPassword = password || (existing.turnitinCredentials && existing.turnitinCredentials.password);
    if (!savedPassword) { showError('credError', 'Please enter password'); return; }
    chrome.storage.local.set({ turnitinCredentials: { username: username, password: savedPassword } }, function() {
      document.getElementById('credStatus').className = 'status-badge';
      document.getElementById('credStatus').innerHTML = '<span class="dot"></span>Configured';
      document.getElementById('turnitinPassword').value = '';
      showMessage('credSuccess', 'Credentials saved');
    });
  });
}

function importCookies() {
  var cookieData = document.getElementById('cookieData').value.trim();
  if (!cookieData) { showError('cookieError', 'Please paste your cookie data'); return; }
  try {
    var cookies = parseCookieData(cookieData);
    if (!cookies || cookies.length === 0) { showError('cookieError', 'No valid cookies found. Check format.'); return; }
    chrome.storage.local.set({ turnitinCookies: cookies, cookiesImportedAt: Date.now(), authMethod: 'cookies' }, function() {
      document.getElementById('authMethodCookies').checked = true;
      updateAuthMethodUI('cookies');
      updateCookieStatus(cookies, Date.now());
      document.getElementById('cookieData').value = '';
      showMessage('cookieSuccess', 'Imported ' + cookies.length + ' cookies');
    });
  } catch (error) { showError('cookieError', 'Invalid format: ' + error.message); }
}

function parseCookieData(data) {
  var cookies = [];
  try {
    var jsonData = JSON.parse(data);
    if (Array.isArray(jsonData)) {
      for (var i = 0; i < jsonData.length; i++) {
        var c = jsonData[i];
        if (c.name && c.value) {
          cookies.push({ name: c.name, value: c.value, domain: c.domain || '.turnitin.com', path: c.path || '/', secure: c.secure !== false, httpOnly: c.httpOnly || false, expirationDate: c.expirationDate || c.expires });
        }
      }
      return cookies;
    }
  } catch (e) {}
  var lines = data.split('\\n').filter(function(l) { return l.trim() && !l.startsWith('#'); });
  for (var j = 0; j < lines.length; j++) {
    var line = lines[j];
    var parts = line.split('\\t');
    if (parts.length >= 7) {
      cookies.push({ name: parts[5].trim(), value: parts[6].trim(), domain: parts[0].trim(), path: parts[2].trim(), secure: parts[3].trim().toLowerCase() === 'true', httpOnly: false, expirationDate: parseInt(parts[4]) || undefined });
    } else if (line.indexOf('=') !== -1) {
      var eqIdx = line.indexOf('=');
      var name = line.substring(0, eqIdx).trim();
      var value = line.substring(eqIdx + 1).trim();
      if (name && value) { cookies.push({ name: name, value: value, domain: '.turnitin.com', path: '/', secure: true, httpOnly: false }); }
    }
  }
  return cookies;
}

function exportCurrentCookies() {
  chrome.cookies.getAll({ domain: '.turnitin.com' }, function(cookies) {
    chrome.cookies.getAll({ domain: 'nrtiedu.turnitin.com' }, function(nrtiCookies) {
      var allCookies = cookies.concat(nrtiCookies);
      if (allCookies.length === 0) { showError('cookieError', 'No Turnitin cookies found. Login in browser first.'); return; }
      var cookieJson = JSON.stringify(allCookies.map(function(c) { return { name: c.name, value: c.value, domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly, expirationDate: c.expirationDate }; }), null, 2);
      document.getElementById('cookieData').value = cookieJson;
      showMessage('cookieSuccess', 'Found ' + allCookies.length + ' cookies. Click Import to save.');
    });
  });
}

function testCookies() {
  chrome.storage.local.get(['turnitinCookies', 'turnitinSettings'], function(data) {
    if (!data.turnitinCookies || data.turnitinCookies.length === 0) { showError('cookieError', 'No cookies saved. Import first.'); return; }
    var pending = data.turnitinCookies.length;
    data.turnitinCookies.forEach(function(cookie) {
      chrome.cookies.set({ url: 'https://nrtiedu.turnitin.com', name: cookie.name, value: cookie.value, domain: cookie.domain || '.turnitin.com', path: cookie.path || '/', secure: cookie.secure !== false, httpOnly: cookie.httpOnly || false, expirationDate: cookie.expirationDate }, function() {
        pending--;
        if (pending === 0) {
          var loginUrl = data.turnitinSettings && data.turnitinSettings.loginUrl ? data.turnitinSettings.loginUrl : 'https://nrtiedu.turnitin.com/';
          var homeUrl = loginUrl.replace(/\\/$/, '') + '/home';
          chrome.tabs.create({ url: homeUrl });
          showMessage('cookieSuccess', 'Cookies injected. Check if logged in.');
        }
      });
    });
  });
}

function saveExtensionToken() {
  var token = document.getElementById('extensionToken').value.trim();
  if (!token) { showError('tokenError', 'Please enter token'); return; }
  if (token.indexOf('ext_') !== 0) { showError('tokenError', 'Invalid format. Should start with "ext_"'); return; }
  fetch('https://fyssbzgmhnolazjfwafm.supabase.co/functions/v1/extension-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-extension-token': token },
    body: JSON.stringify({ action: 'heartbeat' })
  }).then(function(r) {
    if (!r.ok) throw new Error('Invalid token');
    chrome.storage.local.set({ extensionToken: token }, function() {
      document.getElementById('extensionToken').value = '';
      document.getElementById('extensionToken').placeholder = '••• Token saved •••';
      showMessage('tokenSuccess', 'Token saved and verified');
    });
  }).catch(function(e) { showError('tokenError', e.message || 'Failed to verify token'); });
}

function saveAdvancedSettings() {
  var pollInterval = parseInt(document.getElementById('pollInterval').value) || 10;
  var maxRetries = parseInt(document.getElementById('maxRetries').value) || 3;
  var reportWaitTime = parseInt(document.getElementById('reportWaitTime').value) || 20;
  chrome.storage.local.set({
    pollInterval: Math.max(5, Math.min(60, pollInterval)),
    maxRetries: Math.max(1, Math.min(10, maxRetries)),
    reportWaitTime: Math.max(5, Math.min(60, reportWaitTime))
  }, function() { showMessage('advancedSuccess', 'Settings saved'); });
}

function showMessage(id, msg) { var el = document.getElementById(id); el.textContent = '✓ ' + msg; el.style.display = 'block'; setTimeout(function() { el.style.display = 'none'; }, 3000); }
function showError(id, msg) { var el = document.getElementById(id); el.textContent = msg; el.style.display = 'block'; setTimeout(function() { el.style.display = 'none'; }, 5000); }`;

const readmeMd = `# Plagaiscans Turnitin Automation Extension

This Chrome/Edge/Kiwi browser extension automatically processes documents from your Plagaiscans queue through Turnitin.

## Features

- 🔄 **Automatic Processing**: Polls for pending documents and processes them automatically
- 📄 **Full Automation**: Logs into Turnitin, uploads files, waits for results, downloads reports
- 📊 **Report Upload**: Automatically uploads AI and Similarity reports back to Plagaiscans
- 🔔 **Notifications**: Get notified when documents are processed
- 🔐 **Secure**: Credentials stored locally in your browser only
- ⚙️ **Configurable**: Set your Turnitin URL, target folder, and workflow options
- ▶️ **Manual Trigger**: Start processing manually with one click

## Installation

### Step 1: Extract the ZIP

1. Extract this ZIP file to a folder on your computer/device

### Step 2: Load in Chrome/Edge/Kiwi

1. Open Chrome and go to \`chrome://extensions/\` (or \`edge://extensions/\` for Edge, or Kiwi extensions menu)
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the extracted folder
5. The extension icon should appear in your toolbar

### Step 3: Configure the Extension

1. Click the extension icon in your toolbar
2. Click **Settings** to open the options page
3. Configure **Turnitin Settings**:
   - Set your Turnitin URL (e.g., https://nrtiedu.turnitin.com/)
   - Set your target folder name (e.g., "Bio 2")
   - Enable/disable "Launch automatically" and AI report options
4. Enter your **Turnitin credentials** (username and password)
5. Enter the **Extension Token** (get this from your Plagaiscans admin dashboard)
6. Save the settings

## Usage

1. **Keep the browser open** - the extension needs the browser running to work
2. **Toggle Auto-Processing** - click the extension icon and toggle on/off
3. **Start Now Button** - manually trigger processing if auto-processing doesn't work
4. **Monitor progress** - the popup shows current status and processing history

## Workflow

1. Extension checks for pending documents
2. Opens your configured Turnitin URL
3. Auto-fills login credentials
4. Clicks "Launch automatically" (if enabled)
5. Navigates to your target folder
6. Uploads document and waits for processing
7. Downloads reports and uploads to Plagaiscans

## Mobile (Kiwi Browser) Notes

This extension uses Manifest V2 for better compatibility with mobile browsers like Kiwi.
- The "Start Processing Now" button is useful on mobile where background scripts may not run continuously
- Keep the popup open or check periodically to ensure processing continues

## Security Notes

- Your Turnitin credentials are **stored locally** in Chrome's secure storage
- Credentials are **never sent** to Plagaiscans servers
- The extension token provides secure, revocable access to the backend

## Requirements

- Google Chrome, Microsoft Edge (Chromium-based), or Kiwi Browser
- Active Turnitin account with login credentials
- Device must remain on with browser open
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
    { step: 1, title: 'Extract the ZIP', description: 'Extract the downloaded ZIP file to a folder on your device' },
    { step: 2, title: 'Open Extensions Page', description: 'Go to chrome://extensions/ (or Kiwi extensions menu)' },
    { step: 3, title: 'Enable Developer Mode', description: 'Toggle on Developer mode in the top right corner' },
    { step: 4, title: 'Load Unpacked', description: 'Click "Load unpacked" and select the extracted folder' },
    { step: 5, title: 'Configure', description: 'Set your Turnitin URL, folder, credentials, and paste your Extension Token' },
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
                  <CardDescription>Chrome, Edge & Kiwi compatible</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">v1.3.0</Badge>
                <Badge variant="outline">Manifest V2</Badge>
                <Badge variant="outline">Mobile Ready</Badge>
                <Badge variant="outline">Cookie Auth</Badge>
              </div>
              
              <p className="text-sm text-muted-foreground">
                This extension automatically processes pending documents through Turnitin Originality and uploads 
                the reports back to your Plagaiscans dashboard. Works on desktop and mobile browsers.
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Configurable Turnitin URL & folder</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Auto "Launch automatically" click</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Manual "Start Now" button for mobile</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Report download & sync</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Secure token-based authentication</span>
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
                  <CardDescription>Before you begin</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Chrome className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Chrome, Edge, or Kiwi Browser</p>
                    <p className="text-xs text-muted-foreground">Chromium-based browser required (including mobile Kiwi)</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <FileCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Turnitin Account</p>
                    <p className="text-xs text-muted-foreground">Active login credentials for your institution's Turnitin portal</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Extension Token</p>
                    <p className="text-xs text-muted-foreground">Generate a secure token below to connect the extension</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Browser Running</p>
                    <p className="text-xs text-muted-foreground">Browser must remain open for automation (use "Start Now" on mobile)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Token Manager */}
        <ExtensionTokenManager />

        {/* Installation Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Installation Steps</CardTitle>
            <CardDescription>Follow these steps to install and configure the extension</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {installationSteps.map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">{item.step}</span>
                  </div>
                  <div>
                    <p className="font-medium">{item.title}</p>
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
