// Options page script for Plagaiscans Turnitin Automation

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSavedSettings();
  setupEventListeners();
}

async function loadSavedSettings() {
  const data = await chrome.storage.local.get([
    'turnitinCredentials',
    'extensionToken',
    'turnitinSettings',
    'pollInterval',
    'maxRetries',
    'reportWaitTime'
  ]);
  
  // Update credential status
  const credStatus = document.getElementById('credStatus');
  if (data.turnitinCredentials?.email) {
    credStatus.className = 'status-badge';
    credStatus.innerHTML = '<span class="dot"></span>Configured';
    document.getElementById('turnitinEmail').value = data.turnitinCredentials.email;
    document.getElementById('turnitinPassword').placeholder = '••••••••••••••••';
  }
  
  // Load extension token (masked)
  if (data.extensionToken) {
    document.getElementById('extensionToken').placeholder = '••• Token saved •••';
  }
  
  // Load Turnitin settings
  if (data.turnitinSettings) {
    document.getElementById('turnitinUrl').value = data.turnitinSettings.loginUrl || 'https://nrtiedu.turnitin.com/';
    document.getElementById('folderName').value = data.turnitinSettings.folderName || 'Bio 2';
    document.getElementById('autoLaunch').checked = data.turnitinSettings.autoLaunch !== false;
    document.getElementById('waitForAiReport').checked = data.turnitinSettings.waitForAiReport !== false;
  } else {
    // Set defaults
    document.getElementById('turnitinUrl').value = 'https://nrtiedu.turnitin.com/';
    document.getElementById('folderName').value = 'Bio 2';
    document.getElementById('autoLaunch').checked = true;
    document.getElementById('waitForAiReport').checked = true;
  }
  
  // Load advanced settings
  if (data.pollInterval) {
    document.getElementById('pollInterval').value = data.pollInterval;
  }
  if (data.maxRetries) {
    document.getElementById('maxRetries').value = data.maxRetries;
  }
  if (data.reportWaitTime) {
    document.getElementById('reportWaitTime').value = data.reportWaitTime;
  }
}

function setupEventListeners() {
  // Turnitin settings form
  document.getElementById('turnitinSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveTurnitinSettings();
  });
  
  // Turnitin credentials form
  document.getElementById('turnitinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveTurnitinCredentials();
  });
  
  // Clear credentials button
  document.getElementById('clearCredsBtn').addEventListener('click', async () => {
    await chrome.storage.local.remove(['turnitinCredentials']);
    document.getElementById('turnitinEmail').value = '';
    document.getElementById('turnitinPassword').value = '';
    document.getElementById('turnitinPassword').placeholder = '••••••••••••';
    
    const credStatus = document.getElementById('credStatus');
    credStatus.className = 'status-badge warning';
    credStatus.innerHTML = '<span class="dot"></span>Not configured';
    
    showMessage('credSuccess', 'Credentials cleared');
  });
  
  // Token form
  document.getElementById('tokenForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveExtensionToken();
  });
  
  // Clear token button
  document.getElementById('clearTokenBtn').addEventListener('click', async () => {
    await chrome.storage.local.remove(['extensionToken']);
    document.getElementById('extensionToken').value = '';
    document.getElementById('extensionToken').placeholder = 'ext_xxxxxxxxxxxx...';
    showMessage('tokenSuccess', 'Token cleared');
  });
  
  // Advanced settings
  document.getElementById('saveAdvancedBtn').addEventListener('click', async () => {
    await saveAdvancedSettings();
  });
}

async function saveTurnitinSettings() {
  const loginUrl = document.getElementById('turnitinUrl').value.trim() || 'https://nrtiedu.turnitin.com/';
  const folderName = document.getElementById('folderName').value.trim() || 'Bio 2';
  const autoLaunch = document.getElementById('autoLaunch').checked;
  const waitForAiReport = document.getElementById('waitForAiReport').checked;
  
  // Validate URL
  try {
    new URL(loginUrl);
  } catch {
    showError('turnitinSettingsError', 'Please enter a valid URL');
    return;
  }
  
  await chrome.storage.local.set({
    turnitinSettings: {
      loginUrl,
      folderName,
      autoLaunch,
      waitForAiReport
    }
  });
  
  showMessage('turnitinSettingsSuccess', 'Turnitin settings saved');
}

async function saveTurnitinCredentials() {
  const email = document.getElementById('turnitinEmail').value.trim();
  const password = document.getElementById('turnitinPassword').value;
  
  if (!email) {
    showError('credError', 'Please enter your email address');
    return;
  }
  
  // If password is empty and we already have credentials, keep the old password
  const existing = await chrome.storage.local.get(['turnitinCredentials']);
  const savedPassword = password || existing.turnitinCredentials?.password;
  
  if (!savedPassword) {
    showError('credError', 'Please enter your password');
    return;
  }
  
  await chrome.storage.local.set({
    turnitinCredentials: {
      email,
      password: savedPassword
    }
  });
  
  // Update status badge
  const credStatus = document.getElementById('credStatus');
  credStatus.className = 'status-badge';
  credStatus.innerHTML = '<span class="dot"></span>Configured';
  
  // Clear password field and update placeholder
  document.getElementById('turnitinPassword').value = '';
  document.getElementById('turnitinPassword').placeholder = '••••••••••••••••';
  
  showMessage('credSuccess', 'Credentials saved successfully');
}

async function saveExtensionToken() {
  const token = document.getElementById('extensionToken').value.trim();
  
  if (!token) {
    showError('tokenError', 'Please enter your extension token');
    return;
  }
  
  // Basic validation - check if it starts with ext_
  if (!token.startsWith('ext_')) {
    showError('tokenError', 'Invalid token format. Should start with "ext_"');
    return;
  }
  
  // Test the token by making a heartbeat request
  try {
    const response = await fetch('https://fyssbzgmhnolazjfwafm.supabase.co/functions/v1/extension-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-extension-token': token
      },
      body: JSON.stringify({ action: 'heartbeat' })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Connection failed' }));
      throw new Error(error.error || 'Invalid token');
    }
  } catch (error) {
    showError('tokenError', error.message || 'Failed to verify token. Please check and try again.');
    return;
  }
  
  await chrome.storage.local.set({ extensionToken: token });
  
  // Clear and update placeholder
  document.getElementById('extensionToken').value = '';
  document.getElementById('extensionToken').placeholder = '••• Token saved •••';
  
  showMessage('tokenSuccess', 'Extension token saved and verified');
}

async function saveAdvancedSettings() {
  const pollInterval = parseInt(document.getElementById('pollInterval').value) || 10;
  const maxRetries = parseInt(document.getElementById('maxRetries').value) || 3;
  const reportWaitTime = parseInt(document.getElementById('reportWaitTime').value) || 20;
  
  await chrome.storage.local.set({
    pollInterval: Math.max(5, Math.min(60, pollInterval)),
    maxRetries: Math.max(1, Math.min(10, maxRetries)),
    reportWaitTime: Math.max(5, Math.min(60, reportWaitTime))
  });
  
  showMessage('advancedSuccess', 'Settings saved');
}

function showMessage(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = '✓ ' + message;
  el.style.display = 'block';
  
  setTimeout(() => {
    el.style.display = 'none';
  }, 3000);
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.style.display = 'block';
  
  setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}
