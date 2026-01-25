// Plagaiscans Turnitin Automation - Content Script
// Runs on Turnitin.com pages to automate the upload and download process

console.log('Plagaiscans Turnitin Automation content script loaded');

// State
let isAutomating = false;
let currentStep = null;
let turnitinSettings = null;

// Configuration
const WAIT_TIMEOUT = 60000; // 60 seconds max wait
const CHECK_INTERVAL = 2000; // Check every 2 seconds
const ACTION_DELAY = 1500; // Delay between actions

// Initialize when page loads
init();

async function init() {
  // Get Turnitin settings from storage
  const data = await chrome.storage.local.get(['turnitinSettings']);
  turnitinSettings = data.turnitinSettings || {
    loginUrl: 'https://nrtiedu.turnitin.com/',
    folderName: 'Bio 2',
    autoLaunch: true,
    waitForAiReport: true
  };
  
  // Check if we're being controlled by the extension
  const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_DOCUMENT' });
  
  if (response?.documentId) {
    console.log('Automation active for document:', response.documentId);
    isAutomating = true;
    
    // Notify background that we're ready
    await chrome.runtime.sendMessage({ type: 'TURNITIN_READY' });
    
    // Start automation based on current page
    await detectPageAndAct();
  }
}

async function detectPageAndAct() {
  const url = window.location.href;
  
  try {
    // Check for login page
    if (url.includes('login') || url.includes('Login') || url.includes('signin') || url.includes('sign-in')) {
      await handleLoginPage();
    } 
    // Check for "Launch automatically" page (post-login landing)
    else if (await shouldClickLaunchButton()) {
      await handleLaunchAutomatically();
    }
    // Check for folder/class selection page
    else if (await shouldNavigateToFolder()) {
      await navigateToFolder(turnitinSettings.folderName);
    }
    // Check for submission/upload page
    else if (url.includes('submission') || url.includes('upload') || await hasFileInput()) {
      await handleSubmissionPage();
    }
    // Check for report/viewer page
    else if (url.includes('report') || url.includes('viewer')) {
      await handleReportPage();
    }
    // Check for dashboard/home
    else if (url.includes('home') || url.includes('dashboard')) {
      await handleDashboard();
    }
    // Try to detect by page content
    else {
      await detectByContent();
    }
  } catch (error) {
    console.error('Automation error:', error);
    await chrome.runtime.sendMessage({ 
      type: 'AUTOMATION_ERROR', 
      error: error.message 
    });
  }
}

async function shouldClickLaunchButton() {
  if (!turnitinSettings.autoLaunch) return false;
  
  await wait(1000);
  
  // Look for "Launch automatically" or similar buttons
  const launchButtons = document.querySelectorAll('button, a, [role="button"]');
  for (const btn of launchButtons) {
    const text = btn.textContent?.toLowerCase() || '';
    if (text.includes('launch') && (text.includes('auto') || text.includes('originality'))) {
      return true;
    }
  }
  
  return false;
}

async function handleLaunchAutomatically() {
  console.log('Looking for Launch Automatically button');
  currentStep = 'launch_automatically';
  
  await wait(2000);
  
  // Find and click "Launch automatically" button
  const buttons = document.querySelectorAll('button, a, [role="button"], .btn, .button');
  for (const btn of buttons) {
    const text = btn.textContent?.toLowerCase() || '';
    if (text.includes('launch') && (text.includes('auto') || text.includes('originality'))) {
      console.log('Found Launch button, clicking...');
      btn.click();
      await waitForNavigation();
      await wait(2000);
      await detectPageAndAct();
      return;
    }
  }
  
  // If no launch button found, continue with detection
  console.log('No Launch button found, continuing detection...');
  await detectByContent();
}

async function shouldNavigateToFolder() {
  await wait(1000);
  
  // Check if we're on a page with folder/class links
  const folderLinks = document.querySelectorAll('a, button, [role="button"], .folder, .class-item, [data-testid*="folder"], [data-testid*="class"]');
  for (const link of folderLinks) {
    const text = link.textContent?.toLowerCase() || '';
    if (text.includes(turnitinSettings.folderName.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

async function navigateToFolder(folderName) {
  console.log(`Navigating to folder: ${folderName}`);
  currentStep = 'navigate_folder';
  
  await wait(2000);
  
  // Find folder link by name (case-insensitive search)
  const allLinks = document.querySelectorAll('a, button, [role="button"], .folder, .class-item, tr, td, .assignment');
  for (const link of allLinks) {
    const text = link.textContent?.trim() || '';
    if (text.toLowerCase().includes(folderName.toLowerCase())) {
      console.log(`Found folder "${folderName}", clicking...`);
      
      // Click the link or a clickable child
      const clickable = link.querySelector('a, button') || link;
      clickable.click();
      
      await waitForNavigation();
      await wait(2000);
      await detectPageAndAct();
      return;
    }
  }
  
  throw new Error(`Could not find folder: ${folderName}`);
}

async function hasFileInput() {
  await wait(500);
  return !!document.querySelector('input[type="file"]');
}

async function detectByContent() {
  await wait(2000); // Wait for page to fully load
  
  // Check for login form
  const loginForm = document.querySelector('form[action*="login"]') || 
                    document.querySelector('input[type="password"]');
  if (loginForm) {
    await handleLoginPage();
    return;
  }
  
  // Check for "Launch automatically" button
  if (await shouldClickLaunchButton()) {
    await handleLaunchAutomatically();
    return;
  }
  
  // Check for folder navigation
  if (await shouldNavigateToFolder()) {
    await navigateToFolder(turnitinSettings.folderName);
    return;
  }
  
  // Check for dashboard/class list
  const classLinks = document.querySelectorAll('a[href*="class"], .class-item, [data-class-id]');
  if (classLinks.length > 0) {
    await handleDashboard();
    return;
  }
  
  // Check for submission form
  const fileInput = document.querySelector('input[type="file"]');
  if (fileInput) {
    await handleSubmissionPage();
    return;
  }
  
  // Check for submit/upload button that might lead to upload page
  const submitButtons = document.querySelectorAll('a, button');
  for (const btn of submitButtons) {
    const text = btn.textContent?.toLowerCase() || '';
    if (text.includes('submit') || text.includes('upload') || text.includes('add submission')) {
      console.log('Found submit/upload button, clicking...');
      btn.click();
      await waitForNavigation();
      await wait(2000);
      await detectPageAndAct();
      return;
    }
  }
  
  console.log('Unknown page type, waiting for navigation...');
}

async function handleLoginPage() {
  console.log('Handling login page');
  currentStep = 'login';
  
  // Get credentials from storage
  const data = await chrome.storage.local.get(['turnitinCredentials']);
  const creds = data.turnitinCredentials;
  
  if (!creds?.email || !creds?.password) {
    throw new Error('Turnitin credentials not configured');
  }
  
  // Wait for login form to be ready
  await waitForElement('input[type="email"], input[name="email"], #email, input[type="text"]');
  
  // Find and fill email field
  const emailInput = document.querySelector('input[type="email"]') || 
                     document.querySelector('input[name="email"]') ||
                     document.querySelector('#email') ||
                     document.querySelector('input[placeholder*="email" i]') ||
                     document.querySelector('input[type="text"]');
  
  if (emailInput) {
    await simulateTyping(emailInput, creds.email);
  }
  
  await wait(ACTION_DELAY);
  
  // Find and fill password field
  const passwordInput = document.querySelector('input[type="password"]') ||
                        document.querySelector('input[name="password"]') ||
                        document.querySelector('#password');
  
  if (passwordInput) {
    await simulateTyping(passwordInput, creds.password);
  }
  
  await wait(ACTION_DELAY);
  
  // Find and click submit button
  const submitButton = document.querySelector('button[type="submit"]') ||
                       document.querySelector('input[type="submit"]') ||
                       document.querySelector('button:contains("Log in")') ||
                       document.querySelector('button:contains("Sign in")') ||
                       document.querySelector('.login-button') ||
                       document.querySelector('[data-testid="login-button"]') ||
                       Array.from(document.querySelectorAll('button')).find(b => 
                         b.textContent?.toLowerCase().includes('log in') || 
                         b.textContent?.toLowerCase().includes('sign in')
                       );
  
  if (submitButton) {
    submitButton.click();
    console.log('Login submitted, waiting for redirect...');
    
    // Wait for page change
    await waitForNavigation();
    await wait(3000); // Extra wait for redirect
    await detectPageAndAct();
  } else {
    throw new Error('Could not find login submit button');
  }
}

async function handleDashboard() {
  console.log('Handling dashboard');
  currentStep = 'dashboard';
  
  await wait(2000);
  
  // First check if we need to navigate to a specific folder
  if (await shouldNavigateToFolder()) {
    await navigateToFolder(turnitinSettings.folderName);
    return;
  }
  
  // Look for a class to submit to - find the first available class
  const classLink = document.querySelector('a[href*="class"]') ||
                    document.querySelector('.class-name') ||
                    document.querySelector('[data-class-id]') ||
                    document.querySelector('.assignment-link');
  
  if (classLink) {
    console.log('Found class link, clicking...');
    classLink.click();
    await waitForNavigation();
    await detectPageAndAct();
  } else {
    // Try to find submit/upload button directly
    const submitLink = document.querySelector('a[href*="submit"]') ||
                       document.querySelector('button:contains("Submit")') ||
                       document.querySelector('[data-action="submit"]');
    
    if (submitLink) {
      submitLink.click();
      await waitForNavigation();
      await detectPageAndAct();
    } else {
      throw new Error('Could not find class or submit link on dashboard');
    }
  }
}

async function handleSubmissionPage() {
  console.log('Handling submission page');
  currentStep = 'upload';
  
  // Request file from background
  const fileInfo = await chrome.runtime.sendMessage({ type: 'REQUEST_FILE' });
  
  if (!fileInfo?.fileData) {
    throw new Error('No file data received from background');
  }
  
  // Convert base64 to File object
  const byteCharacters = atob(fileInfo.fileData.base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: fileInfo.fileData.mimeType });
  const file = new File([blob], fileInfo.fileName, { type: fileInfo.fileData.mimeType });
  
  // Find file input
  const fileInput = await waitForElement('input[type="file"]');
  
  if (!fileInput) {
    throw new Error('Could not find file input on submission page');
  }
  
  // Create a DataTransfer to set the file
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  
  // Trigger change event
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  
  console.log('File attached, looking for title field...');
  await wait(ACTION_DELAY);
  
  // Fill title if required
  const titleInput = document.querySelector('input[name="title"]') ||
                     document.querySelector('#submission-title') ||
                     document.querySelector('input[placeholder*="title" i]');
  
  if (titleInput) {
    await simulateTyping(titleInput, fileInfo.fileName.replace(/\.[^.]+$/, ''));
  }
  
  await wait(ACTION_DELAY);
  
  // Look for submit button
  const submitButton = document.querySelector('button[type="submit"]') ||
                       document.querySelector('input[type="submit"]') ||
                       Array.from(document.querySelectorAll('button')).find(b => 
                         b.textContent?.toLowerCase().includes('submit') || 
                         b.textContent?.toLowerCase().includes('upload')
                       ) ||
                       document.querySelector('.submit-button');
  
  if (submitButton) {
    console.log('Clicking submit button...');
    submitButton.click();
    
    // Wait for submission confirmation
    await waitForSubmissionConfirmation();
  } else {
    throw new Error('Could not find submit button');
  }
}

async function waitForSubmissionConfirmation() {
  console.log('Waiting for submission confirmation...');
  
  // Wait for either success message or redirect
  const startTime = Date.now();
  
  while (Date.now() - startTime < WAIT_TIMEOUT * 2) {
    await wait(CHECK_INTERVAL);
    
    // Check for success indicators
    const successIndicators = [
      document.querySelector('.submission-success'),
      document.querySelector('.success-message'),
      document.querySelector('[data-status="submitted"]'),
      document.body.innerText.includes('successfully submitted'),
      document.body.innerText.includes('submission received'),
      document.body.innerText.includes('successfully uploaded')
    ];
    
    if (successIndicators.some(Boolean)) {
      console.log('Submission confirmed!');
      
      // Try to find submission ID
      const submissionId = extractSubmissionId();
      
      await chrome.runtime.sendMessage({
        type: 'UPLOAD_COMPLETE',
        data: { submissionId }
      });
      
      // Wait for reports to be ready
      await waitForReports();
      return;
    }
    
    // Check if we're on a report/results page already
    if (window.location.href.includes('report') || 
        window.location.href.includes('viewer')) {
      await handleReportPage();
      return;
    }
  }
  
  throw new Error('Timeout waiting for submission confirmation');
}

function extractSubmissionId() {
  // Try to find submission ID from URL or page
  const urlMatch = window.location.href.match(/submission[_-]?id[=\/](\w+)/i);
  if (urlMatch) return urlMatch[1];
  
  const pageMatch = document.body.innerHTML.match(/submission[_-]?id[:\s]+["']?(\w+)["']?/i);
  if (pageMatch) return pageMatch[1];
  
  return null;
}

async function waitForReports() {
  console.log('Waiting for reports to be ready...');
  currentStep = 'waiting_reports';
  
  // Get report wait time from settings
  const data = await chrome.storage.local.get(['reportWaitTime']);
  const maxWaitMinutes = data.reportWaitTime || 20;
  const maxWaitTime = maxWaitMinutes * 60 * 1000;
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    await wait(CHECK_INTERVAL * 3); // Check every 6 seconds
    
    // Look for report links or scores
    const similarityLink = document.querySelector('a[href*="similarity"]') ||
                           document.querySelector('[data-report="similarity"]') ||
                           document.querySelector('.similarity-score') ||
                           document.querySelector('[class*="similarity"]');
    
    const aiLink = document.querySelector('a[href*="ai"]') ||
                   document.querySelector('[data-report="ai"]') ||
                   document.querySelector('.ai-score') ||
                   document.querySelector('[class*="ai-score"]');
    
    // Check for percentage displays
    const percentageElements = document.querySelectorAll('[class*="percent"], [class*="score"]');
    
    if (similarityLink || percentageElements.length > 0) {
      console.log('Reports appear to be ready, downloading...');
      await downloadReports();
      return;
    }
    
    // Check if processing status changed
    const processingIndicator = document.querySelector('.processing, .pending, [data-status="processing"]');
    if (!processingIndicator) {
      // Processing might be done, check for results
      const resultsSection = document.querySelector('.results, .report-section, .submission-detail');
      if (resultsSection) {
        await downloadReports();
        return;
      }
    }
    
    // Refresh page occasionally to check for updates
    if ((Date.now() - startTime) % 60000 < CHECK_INTERVAL * 3) {
      console.log('Refreshing page to check for updates...');
      window.location.reload();
      await wait(5000);
    }
  }
  
  throw new Error('Timeout waiting for reports to be ready');
}

async function downloadReports() {
  console.log('Downloading reports...');
  currentStep = 'downloading_reports';
  
  const reports = {
    similarityReport: null,
    aiReport: null,
    similarityPercentage: null,
    aiPercentage: null
  };
  
  // Try to extract percentages from page
  const similarityScore = document.querySelector('.similarity-score, [data-similarity], .originality-score, [class*="similarity"]');
  if (similarityScore) {
    const match = similarityScore.innerText.match(/(\d+)/);
    if (match) reports.similarityPercentage = parseInt(match[1]);
  }
  
  // Also check for percentage in any score element
  if (!reports.similarityPercentage) {
    const allScores = document.querySelectorAll('[class*="score"], [class*="percent"]');
    for (const score of allScores) {
      const text = score.innerText;
      if (text && !text.toLowerCase().includes('ai')) {
        const match = text.match(/(\d+)\s*%?/);
        if (match) {
          reports.similarityPercentage = parseInt(match[1]);
          break;
        }
      }
    }
  }
  
  const aiScore = document.querySelector('.ai-score, [data-ai-score], [class*="ai-score"]');
  if (aiScore) {
    const match = aiScore.innerText.match(/(\d+)/);
    if (match) reports.aiPercentage = parseInt(match[1]);
  }
  
  // Try to find and click download buttons
  const downloadButtons = document.querySelectorAll(
    'a[href*="download"], button:contains("Download"), [data-action="download"], .download-btn'
  );
  
  for (const button of downloadButtons) {
    const buttonText = button.innerText?.toLowerCase() || '';
    
    if (buttonText.includes('similarity') || buttonText.includes('originality')) {
      const pdfData = await clickAndCaptureDownload(button);
      if (pdfData) reports.similarityReport = pdfData;
    }
    
    if (buttonText.includes('ai') || buttonText.includes('writing')) {
      const pdfData = await clickAndCaptureDownload(button);
      if (pdfData) reports.aiReport = pdfData;
    }
  }
  
  // If we couldn't download via buttons, try to capture from viewer
  if (!reports.similarityReport) {
    reports.similarityReport = await captureReportFromViewer('similarity');
  }
  
  if (!reports.aiReport && turnitinSettings.waitForAiReport) {
    reports.aiReport = await captureReportFromViewer('ai');
  }
  
  // Send reports to background
  await chrome.runtime.sendMessage({
    type: 'REPORTS_READY',
    data: reports
  });
}

async function clickAndCaptureDownload(button) {
  // This is a simplified version - in production you'd intercept downloads
  button.click();
  await wait(2000);
  
  // For now, return null - you'd implement actual download capture
  return null;
}

async function captureReportFromViewer(type) {
  // Try to capture report from an embedded viewer/iframe
  const iframe = document.querySelector(`iframe[src*="${type}"], .report-viewer iframe`);
  
  if (iframe) {
    // Note: Cross-origin restrictions may prevent this
    try {
      // Would need to implement proper PDF extraction
      return null;
    } catch (e) {
      console.log(`Could not capture ${type} report from viewer`);
    }
  }
  
  return null;
}

async function handleReportPage() {
  console.log('On report page');
  await downloadReports();
}

// Utility functions
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
      await wait(2000); // Wait for new page to load
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
    await wait(50 + Math.random() * 50); // Random delay for natural typing
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_AUTOMATION') {
    isAutomating = true;
    detectPageAndAct();
    sendResponse({ started: true });
  }
  return true;
});
