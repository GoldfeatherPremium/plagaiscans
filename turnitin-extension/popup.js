// Popup script for Plagaiscans Turnitin Automation (MV2)

document.addEventListener('DOMContentLoaded', init);

function init() {
  updateStatus();
  setupEventListeners();
  
  // Refresh status periodically
  setInterval(updateStatus, 3000);
}

function updateStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, function(status) {
    if (chrome.runtime.lastError) {
      console.error('Error getting status:', chrome.runtime.lastError);
      return;
    }
    
    if (!status) return;
    
    // Update toggle
    var toggle = document.getElementById('enableToggle');
    toggle.checked = status.isEnabled;
    
    // Update status indicator
    var statusDot = document.getElementById('statusDot');
    var statusText = document.getElementById('statusText');
    
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
    var connectionStatus = document.getElementById('connectionStatus');
    connectionStatus.textContent = status.hasCredentials ? 'Connected' : 'Not configured';
    connectionStatus.style.color = status.hasCredentials ? '#22c55e' : '#fbbf24';
    
    // Update processed count
    document.getElementById('processedCount').textContent = status.processedCount || 0;
    
    // Update start now button state
    var startNowBtn = document.getElementById('startNowBtn');
    if (status.isProcessing) {
      startNowBtn.disabled = true;
      startNowBtn.textContent = 'Processing...';
    } else if (!status.hasCredentials || !status.hasToken) {
      startNowBtn.disabled = true;
      startNowBtn.textContent = '▶ Start Processing Now';
    } else {
      startNowBtn.disabled = false;
      startNowBtn.textContent = '▶ Start Processing Now';
    }
    
    // Show/hide current document
    var currentDocContainer = document.getElementById('currentDocContainer');
    if (status.isProcessing && status.currentDocumentName) {
      currentDocContainer.style.display = 'block';
      document.getElementById('currentDocName').textContent = status.currentDocumentName;
      document.getElementById('currentDocStatus').textContent = formatStatus(status.currentStatus);
    } else {
      currentDocContainer.style.display = 'none';
    }
    
    // Show/hide error
    var errorContainer = document.getElementById('errorContainer');
    if (status.lastError && !status.isProcessing) {
      errorContainer.style.display = 'block';
      document.getElementById('errorMessage').textContent = status.lastError;
    } else {
      errorContainer.style.display = 'none';
    }
    
    // Show/hide credentials warning
    var noCredsContainer = document.getElementById('noCredsContainer');
    noCredsContainer.style.display = status.hasCredentials ? 'none' : 'block';
  });
}

function formatStatus(status) {
  var statusMap = {
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
  document.getElementById('enableToggle').addEventListener('change', function(e) {
    chrome.runtime.sendMessage({ 
      type: 'TOGGLE_ENABLED', 
      enabled: e.target.checked 
    }, function() {
      updateStatus();
    });
  });
  
  // Start Now button
  document.getElementById('startNowBtn').addEventListener('click', function() {
    var btn = document.getElementById('startNowBtn');
    var messageEl = document.getElementById('startNowMessage');
    
    btn.disabled = true;
    btn.textContent = 'Starting...';
    
    chrome.runtime.sendMessage({ type: 'START_PROCESSING_NOW' }, function(result) {
      if (chrome.runtime.lastError) {
        showStartNowMessage('Error: ' + chrome.runtime.lastError.message, 'error');
        btn.disabled = false;
        btn.textContent = '▶ Start Processing Now';
        return;
      }
      
      if (result && result.success) {
        showStartNowMessage(result.message, 'success');
      } else {
        showStartNowMessage(result ? result.message : 'Unknown error', 'error');
        btn.disabled = false;
        btn.textContent = '▶ Start Processing Now';
      }
      
      updateStatus();
    });
  });
  
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // Setup button (in no-creds warning)
  document.getElementById('setupBtn').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', function() {
    updateStatus();
  });
}

function showStartNowMessage(message, type) {
  var messageEl = document.getElementById('startNowMessage');
  messageEl.textContent = message;
  messageEl.className = 'start-now-message ' + type;
  messageEl.style.display = 'block';
  
  setTimeout(function() {
    messageEl.style.display = 'none';
  }, 5000);
}
