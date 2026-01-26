// Plagaiscans Turnitin Automation - Content Script
// Version 1.3.1 - Fixed folder navigation loop and URL-based detection
// Runs on Turnitin Originality (nrtiedu.turnitin.com) to automate upload and download

console.log('Plagaiscans Turnitin Automation content script loaded');

// State
var isAutomating = false;
var currentStep = null;
var turnitinSettings = null;
var currentFileName = null;

// Configuration
var WAIT_TIMEOUT = 120000; // 2 minutes max wait for elements
var CHECK_INTERVAL = 3000; // Check every 3 seconds
var ACTION_DELAY = 2000; // Delay between actions
var REPORT_WAIT_TIME = 20 * 60 * 1000; // 20 minutes max for reports

// Initialize when page loads
init();

async function init() {
  log('Initializing content script...');
  
  // Get Turnitin settings from storage
  var data = await chrome.storage.local.get(['turnitinSettings', 'currentFileName']);
  turnitinSettings = data.turnitinSettings || {
    loginUrl: 'https://nrtiedu.turnitin.com/',
    folderName: 'Bio 2',
    autoLaunch: true,
    waitForAiReport: true
  };
  currentFileName = data.currentFileName;
  
  log('Settings loaded: folder=' + turnitinSettings.folderName);
  
  // Check if we're being controlled by the extension
  var response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_DOCUMENT' });
  
  if (response && response.documentId) {
    log('Automation active for document: ' + response.documentId);
    isAutomating = true;
    
    // Notify background that we're ready
    await chrome.runtime.sendMessage({ type: 'TURNITIN_READY' });
    
    // Wait for page to fully load
    await wait(2000);
    
    // Start automation based on current page
    await detectPageAndAct();
  } else {
    log('No active document, content script idle');
  }
}

function log(message) {
  console.log('[Plagaiscans] [' + currentStep + '] ' + message);
  
  // Send logs to background for server logging
  chrome.runtime.sendMessage({
    type: 'LOG',
    message: message,
    step: currentStep
  }).catch(function() {});
}

async function detectPageAndAct() {
  var url = window.location.href;
  currentStep = 'detect';
  log('Detecting page: ' + url);
  
  // Check auth method first
  var authData = await chrome.storage.local.get(['authMethod']);
  var usingCookies = authData.authMethod === 'cookies';
  
  try {
    // Step 1: Check for login page FIRST
    if (isLoginPage()) {
      currentStep = 'login';
      if (usingCookies) {
        log('Using cookie auth, redirecting from login to home...');
        var homeUrl = turnitinSettings.loginUrl.replace(/\/$/, '') + '/home';
        window.location.href = homeUrl;
        return;
      }
      await handleLoginPage();
      return;
    }
    
    // Step 2: Check for "Launch" button (Turnitin Originality card on dashboard)
    // This MUST come before folder detection because dashboard may have /home in URL
    if (await hasLaunchButton()) {
      currentStep = 'launch';
      await handleLaunchButton();
      return;
    }
    
    // Step 3: Check if in report viewer
    if (isReportViewer()) {
      currentStep = 'report';
      await handleReportViewer();
      return;
    }
    
    // Step 4: Check for upload modal
    if (hasUploadModal()) {
      currentStep = 'upload';
      await handleUploadModal();
      return;
    }
    
    // Step 5: Check if we're inside Originality tool (folder/file view)
    // This is AFTER Launch button check - if no Launch button, we must be inside the tool
    if (isInsideOriginalityTool()) {
      currentStep = 'myfiles';
      log('Inside Originality tool, handling folder navigation...');
      await handleMyFilesPage();
      return;
    }
    
    // Step 6: Fallback - Check if we're on My Files via DOM elements
    if (isMyFilesPage()) {
      currentStep = 'myfiles';
      log('On My Files page (DOM detected), handling folder navigation...');
      await handleMyFilesPage();
      return;
    }
    
    // Default: try to navigate to home
    currentStep = 'navigate';
    log('Unknown page, navigating to home...');
    window.location.href = turnitinSettings.loginUrl.replace(/\/$/, '') + '/home';
    
  } catch (error) {
    currentStep = 'error';
    log('ERROR: ' + error.message);
    await chrome.runtime.sendMessage({ 
      type: 'AUTOMATION_ERROR', 
      error: error.message 
    });
  }
}

function isLoginPage() {
  var url = window.location.href.toLowerCase();
  if (url.includes('login') || url.includes('signin') || url.includes('sign-in')) {
    return true;
  }
  // Also check for login form
  var loginForm = document.querySelector('input[type="password"]');
  var loginButton = findElementByText(['log in', 'sign in', 'login'], 'button');
  
  // But make sure we're not in an upload modal
  if (hasUploadModal()) {
    return false;
  }
  
  return !!(loginForm || loginButton);
}

async function hasLaunchButton() {
  await wait(1500);
  
  // First check if "Turnitin Originality" text exists on page (dashboard indicator)
  var pageText = document.body.textContent || '';
  var hasTurnitinOriginalityCard = pageText.includes('Turnitin Originality') && 
                                    pageText.includes('similarity reporting');
  
  log('Page has Turnitin Originality card: ' + hasTurnitinOriginalityCard);
  
  // Look for VISIBLE Launch button
  var buttons = document.querySelectorAll('button, a, [role="button"]');
  for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    var text = (btn.textContent || '').toLowerCase().trim();
    
    // Check visibility
    var isVisible = btn.offsetParent !== null || btn.offsetWidth > 0 || btn.offsetHeight > 0;
    
    // Strict matching for launch button - must be exactly "launch" or similar
    var isLaunchButton = (
      text === 'launch' ||
      text === 'launch automatically' ||
      text.includes('launch originality')
    );
    
    if (isVisible && isLaunchButton) {
      log('Found launch button with text: "' + text + '"');
      return true;
    }
  }
  
  return false;
}

// Check if we're inside the Originality tool (folder/file view, not dashboard)
function isInsideOriginalityTool() {
  var url = window.location.href.toLowerCase();
  
  // Check for Originality-specific URL patterns (after clicking Launch)
  if (url.includes('/originality') || url.includes('/my-files') || url.includes('/files')) {
    log('URL indicates inside Originality tool');
    return true;
  }
  
  // Check for folder/file list indicators (table with files)
  var hasFileTable = document.querySelector('table tbody tr, [role="grid"] [role="row"]');
  var hasUploadBtn = findElementByText(['upload'], 'button, a');
  var hasFolderList = document.querySelector('[class*="folder"], [data-testid*="folder"]');
  
  // If we have a file table or upload button without the Launch card, we're inside
  if ((hasFileTable || hasFolderList) && hasUploadBtn) {
    // Double-check we don't have the Launch button visible
    var launchBtn = findElementByText(['launch'], 'button');
    if (!launchBtn || launchBtn.textContent.toLowerCase().trim() !== 'launch') {
      log('DOM indicates inside Originality tool (has file list, no Launch button)');
      return true;
    }
  }
  
  return false;
}

function isMyFilesPage() {
  var url = window.location.href.toLowerCase();
  // Check URL patterns
  if (url.includes('/home') || url.includes('/my-files') || url.includes('/files')) {
    return true;
  }
  // Check for folder list or file list indicators
  var hasFileList = document.querySelector('table, [role="grid"], .file-list, [class*="folder"]');
  var hasUploadBtn = findElementByText(['upload'], 'button, a');
  return !!(hasFileList && hasUploadBtn);
}

function isReportViewer() {
  var url = window.location.href.toLowerCase();
  return url.includes('/report') || url.includes('/viewer') || url.includes('/similarity');
}

function hasUploadModal() {
  var modal = document.querySelector('[role="dialog"], .modal, [class*="modal"]');
  var fileInput = document.querySelector('input[type="file"]');
  return !!(modal && fileInput);
}

// ========== LOGIN HANDLING ==========
async function handleLoginPage() {
  log('Step: Login page');
  currentStep = 'login';
  
  var data = await chrome.storage.local.get(['turnitinCredentials']);
  var creds = data.turnitinCredentials;
  
  if (!creds || !creds.username || !creds.password) {
    throw new Error('Turnitin credentials not configured');
  }
  
  await wait(2000);
  
  // Find and fill username
  var usernameInput = document.querySelector('input[name="username"]') ||
                      document.querySelector('#username') ||
                      document.querySelector('input[placeholder*="username" i]') ||
                      document.querySelector('input[type="text"]:not([type="password"])');
  
  if (usernameInput) {
    await simulateTyping(usernameInput, creds.username);
    log('Username entered');
  } else {
    throw new Error('Could not find username field');
  }
  
  await wait(ACTION_DELAY);
  
  // Find and fill password
  var passwordInput = document.querySelector('input[type="password"]');
  if (passwordInput) {
    await simulateTyping(passwordInput, creds.password);
    log('Password entered');
  } else {
    throw new Error('Could not find password field');
  }
  
  await wait(ACTION_DELAY);
  
  // Click login button
  var loginBtn = findElementByText(['log in', 'sign in', 'login', 'submit'], 'button, input[type="submit"]');
  if (loginBtn) {
    loginBtn.click();
    log('Login submitted');
    await waitForNavigation();
    await wait(3000);
    await detectPageAndAct();
  } else {
    throw new Error('Could not find login button');
  }
}

// ========== LAUNCH BUTTON HANDLING ==========
async function handleLaunchButton() {
  log('Step: Launch button page');
  currentStep = 'launch';
  
  await wait(2000);
  
  var launchBtn = findElementByText(['launch', 'launch automatically', 'launch originality'], 'button, a, [role="button"]');
  
  if (launchBtn) {
    log('Clicking Launch button...');
    launchBtn.click();
    await waitForNavigation();
    await wait(3000);
    // After clicking, page should reload/navigate and init() will re-run
  } else {
    log('No Launch button found, continuing...');
    await handleMyFilesPage();
  }
}

// ========== MY FILES PAGE HANDLING ==========
async function handleMyFilesPage() {
  log('Step: My Files page');
  currentStep = 'my_files';
  
  await wait(2000);
  
  // Check if we're already in the target folder
  var isInTargetFolder = checkIfInFolder(turnitinSettings.folderName);
  
  if (!isInTargetFolder) {
    // Navigate to the folder first
    log('Not in target folder, navigating to: ' + turnitinSettings.folderName);
    await navigateToFolder();
    return;
  }
  
  log('In target folder: ' + turnitinSettings.folderName);
  
  // Check if our document was already uploaded (look for it in the list)
  if (await isDocumentAlreadyUploaded()) {
    log('Document already uploaded, checking for results...');
    await waitForReportsAndDownload();
    return;
  }
  
  // Click the Upload button
  await clickUploadButton();
}

function checkIfInFolder(folderName) {
  var folderLower = folderName.toLowerCase();
  
  // Check breadcrumb for folder name
  var breadcrumb = document.querySelector('[class*="breadcrumb"], .breadcrumb, nav[aria-label*="breadcrumb"]');
  if (breadcrumb && breadcrumb.textContent.toLowerCase().includes(folderLower)) {
    log('Found folder in breadcrumb');
    return true;
  }
  
  // Check page title or header
  var headers = document.querySelectorAll('h1, h2, [class*="header"], [class*="title"]');
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].textContent.toLowerCase().includes(folderLower)) {
      log('Found folder in header');
      return true;
    }
  }
  
  // Check URL
  if (window.location.href.toLowerCase().includes(encodeURIComponent(folderLower).toLowerCase())) {
    log('Found folder in URL');
    return true;
  }
  
  return false;
}

async function navigateToFolder() {
  log('Looking for folder: ' + turnitinSettings.folderName);
  var folderLower = turnitinSettings.folderName.toLowerCase();
  
  await wait(2000);
  
  // Find folder in the file/folder list
  var rows = document.querySelectorAll('tr, [role="row"], [class*="row"], [class*="folder"], [class*="item"]');
  
  log('Found ' + rows.length + ' rows to check');
  
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var text = (row.textContent || '').toLowerCase();
    
    // Check if this row contains the folder name
    if (text.includes(folderLower)) {
      // Look for folder indicators
      var hasFolder = row.querySelector('[class*="folder"], svg[data-icon*="folder"], .folder-icon') ||
                      row.innerHTML.toLowerCase().includes('folder');
      
      // Accept if it has folder indicator OR text exactly matches folder name
      if (hasFolder || text.trim().includes(folderLower)) {
        log('Found folder row with text: ' + text.substring(0, 50) + '...');
        
        // Click the folder name link/button
        var clickable = row.querySelector('a, button, [role="button"], [class*="name"]') || row;
        log('Clicking element: ' + (clickable.tagName || 'unknown'));
        clickable.click();
        
        await waitForNavigation();
        await wait(3000);
        
        // Verify we navigated
        var nowInFolder = checkIfInFolder(turnitinSettings.folderName);
        if (nowInFolder) {
          log('Successfully navigated to folder');
          await handleMyFilesPage();
        } else {
          log('Navigation may have failed, retrying detection...');
          await detectPageAndAct();
        }
        return;
      }
    }
  }
  
  // Try finding by link text directly
  var folderLink = findElementByText([turnitinSettings.folderName], 'a, button, [role="button"]');
  if (folderLink) {
    log('Found folder link by text, clicking...');
    folderLink.click();
    await waitForNavigation();
    await wait(3000);
    await detectPageAndAct();
    return;
  }
  
  throw new Error('Could not find folder: ' + turnitinSettings.folderName);
}

async function isDocumentAlreadyUploaded() {
  if (!currentFileName) return false;
  
  var cleanName = currentFileName.replace(/\.[^.]+$/, '').toLowerCase();
  var pageText = document.body.textContent.toLowerCase();
  
  return pageText.includes(cleanName);
}

async function clickUploadButton() {
  log('Looking for Upload button...');
  
  // Find the Upload button (typically blue button in header)
  var uploadBtn = findElementByText(['upload'], 'button, a, [role="button"]');
  
  if (uploadBtn) {
    log('Clicking Upload button...');
    uploadBtn.click();
    await wait(2000);
    
    // Check if modal appeared
    if (hasUploadModal()) {
      await handleUploadModal();
    } else {
      // Maybe it navigated to upload page
      await detectPageAndAct();
    }
  } else {
    throw new Error('Could not find Upload button');
  }
}

// ========== UPLOAD MODAL HANDLING ==========
async function handleUploadModal() {
  log('Step: Upload modal');
  currentStep = 'upload';
  
  await wait(2000);
  
  // Request file from background
  var fileInfo = await chrome.runtime.sendMessage({ type: 'REQUEST_FILE' });
  
  if (!fileInfo || !fileInfo.fileData) {
    throw new Error('No file data received from background');
  }
  
  log('Got file: ' + fileInfo.fileName);
  
  // Convert base64 to File object
  var byteCharacters = atob(fileInfo.fileData.base64);
  var byteNumbers = new Array(byteCharacters.length);
  for (var i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  var byteArray = new Uint8Array(byteNumbers);
  var blob = new Blob([byteArray], { type: fileInfo.fileData.mimeType || 'application/octet-stream' });
  var file = new File([blob], fileInfo.fileName, { type: blob.type });
  
  // Find file input
  var fileInput = document.querySelector('input[type="file"]');
  
  if (!fileInput) {
    // Try waiting for it
    fileInput = await waitForElement('input[type="file"]');
  }
  
  if (!fileInput) {
    throw new Error('Could not find file input');
  }
  
  // Attach file
  var dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  
  log('File attached');
  await wait(ACTION_DELAY);
  
  // Fill title if there's a title field
  var titleInput = document.querySelector('input[name="title"], input[placeholder*="title" i], #title, [class*="title"] input');
  if (titleInput) {
    var title = fileInfo.fileName.replace(/\.[^.]+$/, '');
    await simulateTyping(titleInput, title);
    log('Title entered: ' + title);
  }
  
  await wait(ACTION_DELAY);
  
  // Find and click submit/upload confirm button
  var submitBtn = findElementByText(['upload', 'submit', 'confirm', 'add'], 'button, input[type="submit"]');
  
  if (submitBtn) {
    log('Clicking submit button...');
    submitBtn.click();
    
    await wait(3000);
    
    // Notify background of upload
    await chrome.runtime.sendMessage({
      type: 'UPLOAD_COMPLETE',
      data: { submissionId: 'pending', fileName: fileInfo.fileName }
    });
    
    // Wait for modal to close and file to appear in list
    await wait(5000);
    
    // Refresh and check for results
    window.location.reload();
  } else {
    throw new Error('Could not find submit button in upload modal');
  }
}

// ========== WAIT FOR REPORTS ==========
async function waitForReportsAndDownload() {
  log('Step: Waiting for reports');
  currentStep = 'waiting_reports';
  
  var startTime = Date.now();
  var checkCount = 0;
  
  while (Date.now() - startTime < REPORT_WAIT_TIME) {
    checkCount++;
    log('Checking for reports... (attempt ' + checkCount + ')');
    
    await wait(CHECK_INTERVAL);
    
    // Find our document row
    var docRow = findDocumentRow();
    
    if (docRow) {
      // Check for similarity percentage (not processing/pending)
      var scores = extractScoresFromRow(docRow);
      
      if (scores.similarityReady) {
        log('Reports ready! Similarity: ' + scores.similarity + '%, AI: ' + (scores.ai || 'N/A') + '%');
        
        // Click on the document row to open viewer
        await openDocumentAndDownload(docRow, scores);
        return;
      }
    }
    
    // Refresh page every 60 seconds to check for updates
    if (checkCount % 20 === 0) {
      log('Refreshing page to check for updates...');
      window.location.reload();
      return; // Will re-enter through init()
    }
  }
  
  throw new Error('Timeout waiting for reports to be ready');
}

function findDocumentRow() {
  if (!currentFileName) return null;
  
  var cleanName = currentFileName.replace(/\.[^.]+$/, '').toLowerCase();
  var rows = document.querySelectorAll('tr, [role="row"], [class*="row"]');
  
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var text = (row.textContent || '').toLowerCase();
    
    if (text.includes(cleanName)) {
      return row;
    }
  }
  
  return null;
}

function extractScoresFromRow(row) {
  var result = {
    similarity: null,
    ai: null,
    similarityReady: false,
    aiReady: false
  };
  
  var text = row.textContent || '';
  
  // Find percentage patterns
  var percentages = text.match(/(\d+)\s*%/g);
  
  if (percentages && percentages.length >= 1) {
    // First percentage is usually similarity
    result.similarity = parseInt(percentages[0]);
    result.similarityReady = !text.includes('processing') && !text.includes('*%');
    
    if (percentages.length >= 2) {
      result.ai = parseInt(percentages[1]);
      result.aiReady = true;
    }
  }
  
  return result;
}

async function openDocumentAndDownload(row, scores) {
  log('Opening document for report download');
  currentStep = 'downloading_reports';
  
  // Click on similarity score to open viewer
  var clickable = row.querySelector('[class*="similarity"], [class*="score"], a') || row;
  clickable.click();
  
  await wait(3000);
  
  // Handle the report viewer page
  await handleReportViewer();
}

async function handleReportViewer() {
  log('Step: Report viewer');
  currentStep = 'report_viewer';
  
  await wait(2000);
  
  var similarityReport = null;
  var aiReport = null;
  
  // Look for download button (usually an arrow or download icon)
  var downloadBtn = document.querySelector('[class*="download"], [aria-label*="download"], button[title*="download"]');
  
  if (!downloadBtn) {
    // Try finding by icon
    downloadBtn = document.querySelector('svg[data-icon="download"], [class*="arrow-down"], .export-btn');
  }
  
  if (!downloadBtn) {
    // Try text-based
    downloadBtn = findElementByText(['download', 'export'], 'button, a, [role="button"]');
  }
  
  if (downloadBtn) {
    // Download similarity report
    log('Clicking download for Similarity report...');
    downloadBtn.click();
    await wait(1500);
    
    var simOption = findElementByText(['similarity'], 'button, a, [role="menuitem"], li');
    if (simOption) {
      simOption.click();
      await wait(3000);
      log('Similarity report download initiated');
    }
    
    // Download AI report
    log('Clicking download for AI report...');
    downloadBtn.click();
    await wait(1500);
    
    var aiOption = findElementByText(['ai', 'writing'], 'button, a, [role="menuitem"], li');
    if (aiOption) {
      aiOption.click();
      await wait(3000);
      log('AI report download initiated');
    }
  } else {
    log('Could not find download button, trying alternative methods...');
  }
  
  // Send completion to background
  log('Notifying background of report downloads...');
  await chrome.runtime.sendMessage({
    type: 'REPORTS_READY',
    data: {
      similarityReport: similarityReport,
      aiReport: aiReport,
      similarityPercentage: 0,
      aiPercentage: 0
    }
  });
}

// ========== UTILITY FUNCTIONS ==========
function wait(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

function waitForElement(selector, timeout) {
  timeout = timeout || WAIT_TIMEOUT;
  
  return new Promise(function(resolve) {
    var startTime = Date.now();
    
    function check() {
      var element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        resolve(null);
        return;
      }
      
      setTimeout(check, 500);
    }
    
    check();
  });
}

function waitForNavigation() {
  return new Promise(function(resolve) {
    var currentUrl = window.location.href;
    var checks = 0;
    
    function check() {
      checks++;
      if (window.location.href !== currentUrl || checks > 30) {
        resolve();
        return;
      }
      setTimeout(check, 500);
    }
    
    check();
  });
}

function findElementByText(texts, selectors) {
  if (!Array.isArray(texts)) {
    texts = [texts];
  }
  
  var elements = document.querySelectorAll(selectors);
  
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var elText = (el.textContent || '').toLowerCase().trim();
    
    for (var j = 0; j < texts.length; j++) {
      if (elText.includes(texts[j].toLowerCase())) {
        // Check if visible
        if (el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0) {
          return el;
        }
      }
    }
  }
  
  return null;
}

async function simulateTyping(element, text) {
  element.focus();
  element.value = '';
  
  for (var i = 0; i < text.length; i++) {
    element.value += text[i];
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(50);
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
