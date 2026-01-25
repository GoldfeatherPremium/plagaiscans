// Popup script for Plagaiscans Turnitin Automation (MV2)

document.addEventListener('DOMContentLoaded', init);

function init() {
  // Test background connection first
  testBackgroundConnection();
  setupEventListeners();
  
  // Refresh status periodically
  setInterval(updateStatus, 3000);
}

function testBackgroundConnection() {
  try {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, function(status) {
      if (chrome.runtime.lastError) {
        console.error('Background inactive:', chrome.runtime.lastError);
        showBackgroundInactiveState();
        // Try to wake it up
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
        chrome.alarms.create('pollDocuments', { periodInMinutes: 0.17 });
        // Retry status update after a short delay
        setTimeout(function() {
          updateStatus();
        }, 500);
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
  
  if (statusDot) {
    statusDot.className = 'status-dot error';
  }
  if (statusText) {
    statusText.textContent = 'Background Inactive';
  }
  if (connectionStatus) {
    connectionStatus.textContent = 'Tap Refresh to wake up';
    connectionStatus.style.color = '#ef4444';
  }
  if (startNowBtn) {
    startNowBtn.disabled = true;
    startNowBtn.textContent = 'Background Inactive';
  }
  if (errorContainer && errorMessage) {
    errorContainer.style.display = 'block';
    errorMessage.textContent = 'Background script is sleeping. Tap Refresh to wake it up.';
  }
}

function updateStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, function(status) {
    if (chrome.runtime.lastError) {
      console.error('Error getting status:', chrome.runtime.lastError);
      showBackgroundInactiveState();
      return;
    }
    
    if (!status) {
      showBackgroundInactiveState();
      return;
    }
    
    updateStatusUI(status);
  });
}

function updateStatusUI(status) {
  // Update toggle
  var toggle = document.getElementById('enableToggle');
  if (toggle) {
    toggle.checked = status.isEnabled;
  }
  
  // Update status indicator
  var statusDot = document.getElementById('statusDot');
  var statusText = document.getElementById('statusText');
  
  if (statusDot) {
    statusDot.className = 'status-dot';
    
    if (status.lastError && status.currentStatus === 'error') {
      statusDot.classList.add('error');
    } else if (status.isProcessing || status.currentStatus === 'processing') {
      statusDot.classList.add('processing');
    } else if (status.isEnabled) {
      statusDot.classList.add('success');
    } else {
      statusDot.classList.add('idle');
    }
  }
  
  if (statusText) {
    if (status.lastError && status.currentStatus === 'error') {
      statusText.textContent = 'Error';
    } else if (status.isProcessing || status.currentStatus === 'processing') {
      statusText.textContent = formatStatus(status.currentStatus);
    } else if (status.isEnabled) {
      statusText.textContent = 'Ready';
    } else {
      statusText.textContent = 'Disabled';
    }
  }
  
  // Update connection status
  var connectionStatus = document.getElementById('connectionStatus');
  if (connectionStatus) {
    connectionStatus.textContent = status.hasCredentials ? 'Connected' : 'Not configured';
    connectionStatus.style.color = status.hasCredentials ? '#22c55e' : '#fbbf24';
  }
  
  // Update processed count
  var processedCountEl = document.getElementById('processedCount');
  if (processedCountEl) {
    processedCountEl.textContent = status.processedCount || 0;
  }
  
  // Update start now button state
  var startNowBtn = document.getElementById('startNowBtn');
  if (startNowBtn) {
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
  }
  
  // Show/hide current document
  var currentDocContainer = document.getElementById('currentDocContainer');
  if (currentDocContainer) {
    if (status.isProcessing && status.currentDocumentName) {
      currentDocContainer.style.display = 'block';
      var docNameEl = document.getElementById('currentDocName');
      var docStatusEl = document.getElementById('currentDocStatus');
      if (docNameEl) docNameEl.textContent = status.currentDocumentName;
      if (docStatusEl) docStatusEl.textContent = formatStatus(status.currentStatus);
    } else {
      currentDocContainer.style.display = 'none';
    }
  }
  
  // Show/hide error
  var errorContainer = document.getElementById('errorContainer');
  if (errorContainer) {
    var errorMessage = document.getElementById('errorMessage');
    if (status.lastError && !status.isProcessing) {
      errorContainer.style.display = 'block';
      if (errorMessage) errorMessage.textContent = status.lastError;
    } else {
      errorContainer.style.display = 'none';
    }
  }
  
  // Show/hide credentials warning
  var noCredsContainer = document.getElementById('noCredsContainer');
  if (noCredsContainer) {
    noCredsContainer.style.display = status.hasCredentials ? 'none' : 'block';
  }
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
  var enableToggle = document.getElementById('enableToggle');
  if (enableToggle) {
    enableToggle.addEventListener('change', function(e) {
      chrome.runtime.sendMessage({ 
        type: 'TOGGLE_ENABLED', 
        enabled: e.target.checked 
      }, function() {
        updateStatus();
      });
    });
  }
  
  // Start Now button
  var startNowBtn = document.getElementById('startNowBtn');
  if (startNowBtn) {
    startNowBtn.addEventListener('click', function() {
      var btn = document.getElementById('startNowBtn');
      
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
  }
  
  // Settings button
  var settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function() {
      chrome.runtime.openOptionsPage();
    });
  }
  
  // Setup button (in no-creds warning)
  var setupBtn = document.getElementById('setupBtn');
  if (setupBtn) {
    setupBtn.addEventListener('click', function() {
      chrome.runtime.openOptionsPage();
    });
  }
  
  // Refresh button - also tries to wake up background
  var refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      // Try to wake up background script
      wakeUpBackground();
    });
  }
}

function showStartNowMessage(message, type) {
  var messageEl = document.getElementById('startNowMessage');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.className = 'start-now-message ' + type;
    messageEl.style.display = 'block';
    
    setTimeout(function() {
      messageEl.style.display = 'none';
    }, 5000);
  }
}
