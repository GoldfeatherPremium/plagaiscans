// Options page script for Plagaiscans Turnitin Automation

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSavedSettings();
  setupEventListeners();
}

async function loadSavedSettings() {
  const data = await chrome.storage.local.get([
    'turnitinCredentials',
    'supabaseServiceKey',
    'pollInterval',
    'maxRetries'
  ]);
  
  // Update credential status
  const credStatus = document.getElementById('credStatus');
  if (data.turnitinCredentials?.email) {
    credStatus.className = 'status-badge';
    credStatus.innerHTML = '<span class="dot"></span>Configured';
    document.getElementById('turnitinEmail').value = data.turnitinCredentials.email;
    // Don't show password, just indicate it's set
    document.getElementById('turnitinPassword').placeholder = '••••••••••••••••';
  }
  
  // Load service key (masked)
  if (data.supabaseServiceKey) {
    document.getElementById('serviceKey').placeholder = '••• Key saved •••';
  }
  
  // Load advanced settings
  if (data.pollInterval) {
    document.getElementById('pollInterval').value = data.pollInterval;
  }
  if (data.maxRetries) {
    document.getElementById('maxRetries').value = data.maxRetries;
  }
}

function setupEventListeners() {
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
  
  // Supabase form
  document.getElementById('supabaseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveServiceKey();
  });
  
  // Clear key button
  document.getElementById('clearKeyBtn').addEventListener('click', async () => {
    await chrome.storage.local.remove(['supabaseServiceKey']);
    document.getElementById('serviceKey').value = '';
    document.getElementById('serviceKey').placeholder = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
    showMessage('keySuccess', 'Service key cleared');
  });
  
  // Advanced settings
  document.getElementById('saveAdvancedBtn').addEventListener('click', async () => {
    await saveAdvancedSettings();
  });
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

async function saveServiceKey() {
  const key = document.getElementById('serviceKey').value.trim();
  
  if (!key) {
    showError('keyError', 'Please enter the service role key');
    return;
  }
  
  // Basic validation - check if it looks like a JWT
  if (!key.startsWith('eyJ')) {
    showError('keyError', 'Invalid key format. Should start with "eyJ"');
    return;
  }
  
  // Test the connection
  try {
    const response = await fetch('https://fyssbzgmhnolazjfwafm.supabase.co/rest/v1/documents?limit=1', {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Connection failed');
    }
  } catch (error) {
    showError('keyError', 'Failed to connect. Please check the key.');
    return;
  }
  
  await chrome.storage.local.set({ supabaseServiceKey: key });
  
  // Clear and update placeholder
  document.getElementById('serviceKey').value = '';
  document.getElementById('serviceKey').placeholder = '••• Key saved •••';
  
  showMessage('keySuccess', 'Service key saved and verified');
}

async function saveAdvancedSettings() {
  const pollInterval = parseInt(document.getElementById('pollInterval').value) || 10;
  const maxRetries = parseInt(document.getElementById('maxRetries').value) || 3;
  
  await chrome.storage.local.set({
    pollInterval: Math.max(5, Math.min(60, pollInterval)), // 5-60 seconds
    maxRetries: Math.max(1, Math.min(10, maxRetries)) // 1-10 retries
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
