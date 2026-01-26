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
    'reportWaitTime',
    'authMethod',
    'turnitinCookies',
    'cookiesImportedAt',
    'autoProcessNext'
  ]);
  
  // Update credential status
  const credStatus = document.getElementById('credStatus');
  if (data.turnitinCredentials?.username) {
    credStatus.className = 'status-badge';
    credStatus.innerHTML = '<span class="dot"></span>Configured';
    document.getElementById('turnitinUsername').value = data.turnitinCredentials.username;
    document.getElementById('turnitinPassword').placeholder = '••••••••••••••••';
  }
  
  // Load extension token (masked)
  if (data.extensionToken) {
    document.getElementById('extensionToken').placeholder = '••• Token saved •••';
  }
  
  // Load auth method
  const authMethod = data.authMethod || 'credentials';
  document.getElementById('authMethodCredentials').checked = authMethod === 'credentials';
  document.getElementById('authMethodCookies').checked = authMethod === 'cookies';
  updateAuthMethodUI(authMethod);
  
  // Load cookie status
  updateCookieStatus(data.turnitinCookies, data.cookiesImportedAt);
  
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
  
  // Load auto-process setting (default to false for single-file mode)
  document.getElementById('autoProcessNext').checked = data.autoProcessNext === true;
}

function updateAuthMethodUI(method) {
  const credentialsSection = document.getElementById('credentialsSection');
  const cookiesSection = document.getElementById('cookiesSection');
  
  if (method === 'cookies') {
    credentialsSection.style.display = 'none';
    cookiesSection.style.display = 'block';
  } else {
    credentialsSection.style.display = 'block';
    cookiesSection.style.display = 'none';
  }
}

function updateCookieStatus(cookies, importedAt) {
  const cookieStatus = document.getElementById('cookieStatus');
  
  if (cookies && cookies.length > 0) {
    const importDate = importedAt ? new Date(importedAt).toLocaleString() : 'Unknown';
    const cookieCount = cookies.length;
    
    // Check for expiration
    const now = Date.now() / 1000;
    const expiredCookies = cookies.filter(c => c.expirationDate && c.expirationDate < now);
    
    if (expiredCookies.length > 0) {
      cookieStatus.className = 'status-badge warning';
      cookieStatus.innerHTML = `<span class="dot"></span>${expiredCookies.length} expired cookies`;
    } else {
      cookieStatus.className = 'status-badge';
      cookieStatus.innerHTML = `<span class="dot"></span>${cookieCount} cookies saved`;
    }
    
    document.getElementById('cookieInfo').textContent = `Imported: ${importDate}`;
    document.getElementById('cookieInfo').style.display = 'block';
  } else {
    cookieStatus.className = 'status-badge warning';
    cookieStatus.innerHTML = '<span class="dot"></span>Not configured';
    document.getElementById('cookieInfo').style.display = 'none';
  }
}

function setupEventListeners() {
  // Auth method toggle
  document.getElementById('authMethodCredentials').addEventListener('change', function() {
    if (this.checked) {
      chrome.storage.local.set({ authMethod: 'credentials' });
      updateAuthMethodUI('credentials');
    }
  });
  
  document.getElementById('authMethodCookies').addEventListener('change', function() {
    if (this.checked) {
      chrome.storage.local.set({ authMethod: 'cookies' });
      updateAuthMethodUI('cookies');
    }
  });
  
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
    document.getElementById('turnitinUsername').value = '';
    document.getElementById('turnitinPassword').value = '';
    document.getElementById('turnitinPassword').placeholder = '••••••••••••';
    
    const credStatus = document.getElementById('credStatus');
    credStatus.className = 'status-badge warning';
    credStatus.innerHTML = '<span class="dot"></span>Not configured';
    
    showMessage('credSuccess', 'Credentials cleared');
  });
  
  // Cookie import form
  document.getElementById('cookieForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await importCookies();
  });
  
  // Export current cookies button
  document.getElementById('exportCookiesBtn').addEventListener('click', async () => {
    await exportCurrentCookies();
  });
  
  // Test cookies button
  document.getElementById('testCookiesBtn').addEventListener('click', async () => {
    await testCookies();
  });
  
  // Clear cookies button
  document.getElementById('clearCookiesBtn').addEventListener('click', async () => {
    await chrome.storage.local.remove(['turnitinCookies', 'cookiesImportedAt']);
    document.getElementById('cookieData').value = '';
    updateCookieStatus(null, null);
    showMessage('cookieSuccess', 'Cookies cleared');
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
  const username = document.getElementById('turnitinUsername').value.trim();
  const password = document.getElementById('turnitinPassword').value;
  
  if (!username) {
    showError('credError', 'Please enter your username');
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
      username,
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

async function importCookies() {
  const cookieData = document.getElementById('cookieData').value.trim();
  
  if (!cookieData) {
    showError('cookieError', 'Please paste your cookie data');
    return;
  }
  
  try {
    const cookies = parseCookieData(cookieData);
    
    if (!cookies || cookies.length === 0) {
      showError('cookieError', 'No valid cookies found. Check format.');
      return;
    }
    
    // Save cookies to storage
    await chrome.storage.local.set({
      turnitinCookies: cookies,
      cookiesImportedAt: Date.now(),
      authMethod: 'cookies'
    });
    
    // Update UI
    document.getElementById('authMethodCookies').checked = true;
    updateAuthMethodUI('cookies');
    updateCookieStatus(cookies, Date.now());
    document.getElementById('cookieData').value = '';
    
    showMessage('cookieSuccess', `Imported ${cookies.length} cookies successfully`);
  } catch (error) {
    showError('cookieError', 'Invalid cookie format: ' + error.message);
  }
}

function parseCookieData(data) {
  const cookies = [];
  
  // Try JSON format first (Chrome DevTools export)
  try {
    const jsonData = JSON.parse(data);
    
    if (Array.isArray(jsonData)) {
      for (const cookie of jsonData) {
        if (cookie.name && cookie.value) {
          cookies.push({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || '.turnitin.com',
            path: cookie.path || '/',
            secure: cookie.secure ?? true,
            httpOnly: cookie.httpOnly ?? false,
            expirationDate: cookie.expirationDate || cookie.expires || undefined
          });
        }
      }
      return cookies;
    }
  } catch (e) {
    // Not JSON, try other formats
  }
  
  // Try Netscape format
  const lines = data.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  for (const line of lines) {
    // Netscape format: domain, flag, path, secure, expiration, name, value
    const parts = line.split('\t');
    
    if (parts.length >= 7) {
      cookies.push({
        name: parts[5].trim(),
        value: parts[6].trim(),
        domain: parts[0].trim(),
        path: parts[2].trim(),
        secure: parts[3].trim().toLowerCase() === 'true',
        httpOnly: false,
        expirationDate: parseInt(parts[4]) || undefined
      });
    } else if (line.includes('=')) {
      // Simple key=value format
      const [name, ...valueParts] = line.split('=');
      if (name && valueParts.length > 0) {
        cookies.push({
          name: name.trim(),
          value: valueParts.join('=').trim(),
          domain: '.turnitin.com',
          path: '/',
          secure: true,
          httpOnly: false
        });
      }
    }
  }
  
  return cookies;
}

async function exportCurrentCookies() {
  try {
    // Get all cookies for turnitin.com
    const cookies = await chrome.cookies.getAll({ domain: '.turnitin.com' });
    const nrtiCookies = await chrome.cookies.getAll({ domain: 'nrtiedu.turnitin.com' });
    
    const allCookies = [...cookies, ...nrtiCookies];
    
    if (allCookies.length === 0) {
      showError('cookieError', 'No Turnitin cookies found. Are you logged in?');
      return;
    }
    
    // Format for display
    const cookieJson = JSON.stringify(allCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      expirationDate: c.expirationDate
    })), null, 2);
    
    document.getElementById('cookieData').value = cookieJson;
    showMessage('cookieSuccess', `Found ${allCookies.length} cookies. Click Import to save them.`);
  } catch (error) {
    showError('cookieError', 'Failed to export cookies: ' + error.message);
  }
}

async function testCookies() {
  const data = await chrome.storage.local.get(['turnitinCookies', 'turnitinSettings']);
  
  if (!data.turnitinCookies || data.turnitinCookies.length === 0) {
    showError('cookieError', 'No cookies saved. Import cookies first.');
    return;
  }
  
  try {
    // Inject cookies first
    for (const cookie of data.turnitinCookies) {
      try {
        await chrome.cookies.set({
          url: 'https://nrtiedu.turnitin.com',
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || '.turnitin.com',
          path: cookie.path || '/',
          secure: cookie.secure ?? true,
          httpOnly: cookie.httpOnly ?? false,
          expirationDate: cookie.expirationDate
        });
      } catch (e) {
        console.log('Failed to set cookie:', cookie.name, e);
      }
    }
    
    // Open Turnitin to test
    const loginUrl = data.turnitinSettings?.loginUrl || 'https://nrtiedu.turnitin.com/';
    const homeUrl = loginUrl.replace(/\/$/, '') + '/home';
    
    chrome.tabs.create({ url: homeUrl });
    showMessage('cookieSuccess', 'Cookies injected. Check if you are logged in.');
  } catch (error) {
    showError('cookieError', 'Failed to test cookies: ' + error.message);
  }
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
  const autoProcessNext = document.getElementById('autoProcessNext').checked;
  
  await chrome.storage.local.set({
    pollInterval: Math.max(5, Math.min(60, pollInterval)),
    maxRetries: Math.max(1, Math.min(10, maxRetries)),
    reportWaitTime: Math.max(5, Math.min(60, reportWaitTime)),
    autoProcessNext: autoProcessNext
  });
  
  // If auto-process is now enabled, clear the lastCompletedAt to allow immediate processing
  if (autoProcessNext) {
    await chrome.storage.local.remove(['lastCompletedAt']);
  }
  
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
