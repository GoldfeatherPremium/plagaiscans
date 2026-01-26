// Plagaiscans Turnitin Automation - Content Script
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
  console.log('[Plagaiscans] ' + message);
}

async function detectPageAndAct() {
  var url = window.location.href;
  log('Detecting page: ' + url);
  
  // Check auth method first
  var authData = await chrome.storage.local.get(['authMethod']);
  var usingCookies = authData.authMethod === 'cookies';
  
  try {
    // Step 1: Check for login page
    if (isLoginPage()) {
      if (usingCookies) {
        log('Using cookie auth, redirecting from login to home...');
        var homeUrl = turnitinSettings.loginUrl.replace(/\/$/, '') + '/home';
        window.location.href = homeUrl;
        return;
      }
      await handleLoginPage();
      return;
    }
    
    // Step 2: Check for "Launch" button page (post-login landing)
    if (await hasLaunchButton()) {
      await handleLaunchButton();
      return;
    }
    
    // Step 3: Check if we're on My Files / Home page
    if (isMyFilesPage()) {
      await handleMyFilesPage();
      return;
    }
    
    // Step 4: Check if in report viewer
    if (isReportViewer()) {
      await handleReportViewer();
      return;
    }
    
    // Step 5: Check for upload modal
    if (hasUploadModal()) {
      await handleUploadModal();
      return;
    }
    
    // Default: try to navigate to home
    log('Unknown page, navigating to home...');
    window.location.href = turnitinSettings.loginUrl.replace(/\/$/, '') + '/home';
    
  } catch (error) {
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
  return !!(loginForm || loginButton);
}

async function hasLaunchButton() {
  await wait(1500);
  var launchBtn = findElementByText(['launch', 'launch automatically', 'launch originality'], 'button, a, [role="button"]');
  return !!launchBtn;
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
    await detectPageAndAct();
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
  // Check breadcrumb for folder name
  var breadcrumb = document.querySelector('[class*="breadcrumb"], .breadcrumb, nav[aria-label*="breadcrumb"]');
  if (breadcrumb && breadcrumb.textContent.toLowerCase().includes(folderName.toLowerCase())) {
    return true;
  }
  
  // Check page title or header
  var header = document.querySelector('h1, h2, [class*="header"], [class*="title"]');
  if (header && header.textContent.toLowerCase().includes(folderName.toLowerCase())) {
    return true;
  }
  
  return false;
}

async function navigateToFolder() {
  log('Looking for folder: ' + turnitinSettings.folderName);
  
  await wait(2000);
  
  // Find folder in the file/folder list
  var rows = document.querySelectorAll('tr, [role="row"], [class*="row"], [class*="folder"], [class*="item"]');
  
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var text = row.textContent || '';
    
    // Check if this row contains the folder name and has a folder icon
    if (text.toLowerCase().includes(turnitinSettings.folderName.toLowerCase())) {
      // Look for folder indicators
      var hasFolder = row.querySelector('[class*="folder"], svg[data-icon*="folder"], .folder-icon') ||
                      row.innerHTML.toLowerCase().includes('folder');
      
      if (hasFolder || text.trim() === turnitinSettings.folderName) {
        log('Found folder row, clicking...');
        
        // Click the folder name link/button
        var clickable = row.querySelector('a, button, [role="button"], [class*="name"]') || row;
        clickable.click();
        
        await waitForNavigation();
        await wait(2000);
        await detectPageAndAct();
        return;
      }
    }
  }
  
  // Try finding by link text
  var folderLink = findElementByText([turnitinSettings.folderName], 'a, button, [role="button"]');
  if (folderLink) {
    log('Found folder link, clicking...');
    folderLink.click();
    await waitForNavigation();
    await wait(2000);
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
    similarityReady: false
  };
  
  var cells = row.querySelectorAll('td, [role="cell"], [class*="cell"]');
  var text = row.textContent || '';
  
  // Look for percentage patterns
  var percentMatches = text.match(/(\d+)\s*%/g);
  
  if (percentMatches && percentMatches.length > 0) {
    // First percentage is usually similarity
    var simMatch = percentMatches[0].match(/(\d+)/);
    if (simMatch) {
      result.similarity = parseInt(simMatch[1]);
      result.similarityReady = true;
    }
    
    // Second percentage is usually AI
    if (percentMatches.length > 1) {
      var aiMatch = percentMatches[1].match(/(\d+)/);
      if (aiMatch) {
        result.ai = parseInt(aiMatch[1]);
      }
    }
  }
  
  // Check if still processing
  var isProcessing = text.includes('processing') || text.includes('pending') || text.includes('*%');
  if (isProcessing) {
    result.similarityReady = false;
  }
  
  return result;
}

// ========== DOWNLOAD REPORTS ==========
async function openDocumentAndDownload(row, scores) {
  log('Step: Opening document and downloading reports');
  currentStep = 'downloading';
  
  // Find and click the similarity score/link to open viewer
  var similarityLink = row.querySelector('[class*="similarity"], [class*="score"] a, a[href*="similarity"], a[href*="report"]');
  
  if (!similarityLink) {
    // Try clicking on the score percentage itself
    var cells = row.querySelectorAll('td, [class*="cell"]');
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.textContent && cell.textContent.match(/\d+\s*%/)) {
        var clickable = cell.querySelector('a, button, [role="button"]') || cell;
        similarityLink = clickable;
        break;
      }
    }
  }
  
  if (similarityLink) {
    log('Clicking to open report viewer...');
    similarityLink.click();
    
    await wait(3000);
    
    // Now we should be in the report viewer
    await handleReportViewer(scores);
  } else {
    // Just report the scores without PDF downloads
    log('Could not find link to report viewer, completing with scores only');
    await completeWithScores(scores);
  }
}

async function handleReportViewer(scores) {
  log('Step: Report viewer');
  currentStep = 'report_viewer';
  
  scores = scores || { similarity: null, ai: null };
  
  await wait(3000);
  
  var reports = {
    similarityReport: null,
    aiReport: null,
    similarityPercentage: scores.similarity,
    aiPercentage: scores.ai
  };
  
  // Try to extract scores from viewer if not provided
  if (!reports.similarityPercentage) {
    var scoreElem = document.querySelector('[class*="score"], [class*="percent"], [class*="similarity"]');
    if (scoreElem) {
      var match = scoreElem.textContent.match(/(\d+)/);
      if (match) reports.similarityPercentage = parseInt(match[1]);
    }
  }
  
  // Look for download menu/button (downward arrow)
  var downloadArrow = document.querySelector('[class*="download"], [aria-label*="download"], [data-testid*="download"], svg[class*="arrow-down"], [class*="menu"] button');
  
  if (!downloadArrow) {
    // Try finding by common icons
    var buttons = document.querySelectorAll('button, [role="button"], [class*="icon"]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var html = btn.innerHTML.toLowerCase();
      if (html.includes('download') || html.includes('arrow') || btn.getAttribute('aria-label')?.toLowerCase().includes('download')) {
        downloadArrow = btn;
        break;
      }
    }
  }
  
  if (downloadArrow) {
    log('Found download arrow, clicking...');
    downloadArrow.click();
    await wait(1500);
    
    // Look for download options in dropdown menu
    var menuItems = document.querySelectorAll('[role="menuitem"], [class*="menu"] a, [class*="menu"] button, [class*="dropdown"] a');
    
    // Download similarity report
    var similarityOption = findElementByText(['similarity', 'originality'], '[role="menuitem"], a, button');
    if (similarityOption) {
      log('Downloading similarity report...');
      similarityOption.click();
      await wait(3000);
      
      // Re-open menu for AI report
      downloadArrow.click();
      await wait(1500);
    }
    
    // Download AI report
    var aiOption = findElementByText(['ai', 'writing'], '[role="menuitem"], a, button');
    if (aiOption) {
      log('Downloading AI report...');
      aiOption.click();
      await wait(3000);
    }
  } else {
    log('No download arrow found, trying alternative methods...');
    
    // Try finding direct download links
    var downloadLinks = document.querySelectorAll('a[href*="download"], a[href*=".pdf"]');
    for (var i = 0; i < downloadLinks.length; i++) {
      downloadLinks[i].click();
      await wait(2000);
    }
  }
  
  // For now, complete with just the scores
  // TODO: Implement actual PDF capture via downloads API
  await completeWithScores(reports);
}

async function completeWithScores(scores) {
  log('Completing document with scores');
  
  var reports = {
    similarityReport: null,
    aiReport: null,
    similarityPercentage: scores.similarity || scores.similarityPercentage || null,
    aiPercentage: scores.ai || scores.aiPercentage || null,
    fileName: currentFileName
  };
  
  log('Final scores - Similarity: ' + reports.similarityPercentage + '%, AI: ' + reports.aiPercentage + '%');
  
  await chrome.runtime.sendMessage({
    type: 'REPORTS_READY',
    data: reports
  });
}

// ========== UTILITY FUNCTIONS ==========
function wait(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

function findElementByText(textArray, selector) {
  var elements = document.querySelectorAll(selector || '*');
  
  for (var i = 0; i < elements.length; i++) {
    var elem = elements[i];
    var text = (elem.textContent || '').toLowerCase().trim();
    
    for (var j = 0; j < textArray.length; j++) {
      if (text.includes(textArray[j].toLowerCase())) {
        return elem;
      }
    }
  }
  
  return null;
}

async function waitForElement(selector, timeout) {
  timeout = timeout || WAIT_TIMEOUT;
  var startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    var element = document.querySelector(selector);
    if (element) return element;
    await wait(500);
  }
  
  return null;
}

async function waitForNavigation() {
  var currentUrl = window.location.href;
  var startTime = Date.now();
  
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
  
  for (var i = 0; i < text.length; i++) {
    element.value += text[i];
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(30 + Math.random() * 30);
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// Listen for messages from background
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'START_AUTOMATION') {
    isAutomating = true;
    detectPageAndAct();
    sendResponse({ started: true });
  }
  return true;
});
