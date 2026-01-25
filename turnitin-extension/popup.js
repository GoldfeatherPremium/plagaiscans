// Popup script for Plagaiscans Turnitin Automation

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await updateStatus();
  setupEventListeners();
  
  // Refresh status periodically
  setInterval(updateStatus, 3000);
}

async function updateStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    
    // Update toggle
    const toggle = document.getElementById('enableToggle');
    toggle.checked = status.isEnabled;
    
    // Update status indicator
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    statusDot.className = 'status-dot';
    
    if (status.lastError && status.currentStatus === 'error') {
      statusDot.classList.add('error');
      statusText.textContent = 'Error';
    } else if (status.isProcessing || status.currentStatus === 'processing') {
      statusDot.classList.add('processing');
      statusText.textContent = formatStatus(status.currentStatus);
    } else if (status.isEnabled) {
      statusDot.classList.add('success');
      statusText.textContent = 'Ready';
    } else {
      statusDot.classList.add('idle');
      statusText.textContent = 'Disabled';
    }
    
    // Update connection status
    const connectionStatus = document.getElementById('connectionStatus');
    connectionStatus.textContent = status.hasCredentials ? 'Connected' : 'Not configured';
    connectionStatus.style.color = status.hasCredentials ? '#22c55e' : '#fbbf24';
    
    // Update processed count
    document.getElementById('processedCount').textContent = status.processedCount || 0;
    
    // Show/hide current document
    const currentDocContainer = document.getElementById('currentDocContainer');
    if (status.isProcessing && status.currentDocumentName) {
      currentDocContainer.style.display = 'block';
      document.getElementById('currentDocName').textContent = status.currentDocumentName;
      document.getElementById('currentDocStatus').textContent = formatStatus(status.currentStatus);
    } else {
      currentDocContainer.style.display = 'none';
    }
    
    // Show/hide error
    const errorContainer = document.getElementById('errorContainer');
    if (status.lastError && !status.isProcessing) {
      errorContainer.style.display = 'block';
      document.getElementById('errorMessage').textContent = status.lastError;
    } else {
      errorContainer.style.display = 'none';
    }
    
    // Show/hide credentials warning
    const noCredsContainer = document.getElementById('noCredsContainer');
    noCredsContainer.style.display = status.hasCredentials ? 'none' : 'block';
    
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

function formatStatus(status) {
  const statusMap = {
    'idle': 'Idle',
    'processing': 'Processing...',
    'downloading': 'Downloading file...',
    'opening_turnitin': 'Opening Turnitin...',
    'waiting_for_results': 'Waiting for results...',
    'uploading_reports': 'Uploading reports...',
    'error': 'Error'
  };
  return statusMap[status] || status;
}

function setupEventListeners() {
  // Toggle auto-processing
  document.getElementById('enableToggle').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({ 
      type: 'TOGGLE_ENABLED', 
      enabled: e.target.checked 
    });
    await updateStatus();
  });
  
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Setup button (in no-creds warning)
  document.getElementById('setupBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    await updateStatus();
  });
}
