// NLC Integrations Dashboard - Main JavaScript
// This file is hosted externally to avoid Apps Script template processing issues

console.log('🚀 Dashboard JavaScript loaded from external file');

let allData = null;
let charts = {};

// JIRA Configuration
const JIRA_CONFIG = {
  domain: 'jira.evolution.com',
  projectKey: 'NLCINT'
};

// Check if DOM is already loaded
if (document.readyState === 'loading') {
  console.log('🚀 SCRIPT: DOM is still loading, waiting for DOMContentLoaded');
  window.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 SCRIPT: DOMContentLoaded event fired');
    setupEventListeners();
  });
} else {
  console.log('🚀 SCRIPT: DOM already loaded, setting up listeners immediately');
  setupEventListeners();
}

function setupEventListeners() {
  try {
    console.log('📱 DOM loaded - setting up event listeners...');
    loadDashboard();
    
    // Check if buttons exist
    const testBtn = document.getElementById('testSyncBtn');
    const allBtn = document.getElementById('syncAllBtn');
    const deltaBtn = document.getElementById('syncDeltaBtn');
    
    console.log('📱 Buttons found:', {
      test: !!testBtn,
      all: !!allBtn,
      delta: !!deltaBtn
    });
    
    // Set up button click handlers
    if (testBtn) {
      testBtn.addEventListener('click', function() {
        console.log('🐛 Test button clicked via event listener!');
        console.log('🐛 window.syncData exists:', typeof window.syncData);
        if (typeof window.syncData === 'function') {
          console.log('🐛 Calling window.syncData with debug parameter...');
          window.syncData('debug');
        } else {
          console.error('🐛 ERROR: window.syncData is not a function!');
          alert('Error: Sync function not loaded. Please refresh the page.');
        }
      });
      console.log('📱 Test button event listener attached successfully');
    } else {
      console.error('📱 ERROR: Test button not found in DOM!');
    }
    
    if (allBtn) {
      allBtn.addEventListener('click', () => window.syncData('all'));
      console.log('📱 All sync button event listener attached');
    }
    
    if (deltaBtn) {
      deltaBtn.addEventListener('click', () => window.syncData('delta'));
      console.log('📱 Delta sync button event listener attached');
    }
    
    // Initialize bridge after a short delay to ensure everything is loaded
    setTimeout(initBridge, 500);
    
  } catch (error) {
    console.error('📱 ERROR in setupEventListeners:', error);
    console.error('📱 ERROR stack:', error.stack);
  }
}

function showLoading() {
  document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('show');
}

function showAlert(type, message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  const container = document.querySelector('.container-fluid');
  container.insertBefore(alertDiv, container.firstChild);
  
  setTimeout(() => alertDiv.remove(), 5000);
}

function loadDashboard() {
  showLoading();
  
  google.script.run
    .withSuccessHandler(function(data) {
      hideLoading();
      
      if (data.error) {
        showAlert('danger', `Error: ${data.error}`);
        return;
      }
      
      allData = data;
      renderDashboard(data);
    })
    .withFailureHandler(function(error) {
      hideLoading();
      showAlert('danger', `Failed to load dashboard: ${error.message}`);
    })
    .getDashboardData();
}

function renderDashboard(data) {
  // Update last sync
  document.getElementById('lastSync').textContent = `Last sync: ${data.lastSync || 'Never'}`;
  
  // Render charts and tables
  if (data.summary) {
    renderPeriodChart(data.summary.byPeriod);
    renderEnvironmentChart(data.summary.byEnvironment);
    renderJurisdictionChart(data.summary.byJurisdiction);
    renderTemplateChart(data.summary.byTemplate);
  }
  
  if (data.tickets) {
    renderTicketsTable(data.tickets);
  }
}

// Chart rendering functions would go here...
// (Simplified for now - you can add the full chart logic)

function renderPeriodChart(periodData) {
  console.log('Rendering period chart:', periodData);
  // Chart rendering logic
}

function renderEnvironmentChart(envData) {
  console.log('Rendering environment chart:', envData);
}

function renderJurisdictionChart(jurData) {
  console.log('Rendering jurisdiction chart:', jurData);
}

function renderTemplateChart(templateData) {
  console.log('Rendering template chart:', templateData);
}

function renderTicketsTable(tickets) {
  const tbody = document.getElementById('ticketsTable');
  
  if (tickets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No tickets found</td></tr>';
    return;
  }
  
  const sorted = tickets.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  
  const html = sorted.map(function(ticket) {
    return `<tr>
      <td><strong>${escapeHtml(ticket.issueKey)}</strong></td>
      <td>${escapeHtml(ticket.summary)}</td>
      <td><span class="badge bg-info">${escapeHtml(ticket.issueType)}</span></td>
      <td><span class="badge bg-success">${escapeHtml(ticket.status)}</span></td>
      <td><small>${escapeHtml(ticket.createdDate)}</small></td>
      <td><small>${escapeHtml(ticket.environments)}</small></td>
      <td><small>${escapeHtml(ticket.jurisdiction)}</small></td>
      <td><small>${escapeHtml(ticket.template)}</small></td>
    </tr>`;
  }).join('');
  
  tbody.innerHTML = html;
}

// Bridge functions
function isBridgeAvailable() {
  return typeof window.JiraBridge !== 'undefined' && 
         typeof window.JiraBridge.fetch === 'function';
}

function initBridge() {
  console.log('Initializing JIRA Bridge...');
  console.log('Bridge available:', isBridgeAvailable());
}

// Sync Data Function
console.log('🔧 DEBUG: About to define syncData function...');

window.syncData = async function syncData(type) {
  console.log(`🚀 [syncData] Starting sync with type: ${type}`);
  console.log(`🚀 [syncData] Function called at: ${new Date().toISOString()}`);
  
  const isDebug = type === 'debug';
  const syncMsg = isDebug 
    ? 'Test sync with 10 most recent issues?\n\nThis will fetch a small dataset for testing purposes.'
    : `Sync ${type === 'all' ? 'all' : 'new/updated'} tickets from JIRA?\n\nThis will fetch data directly from JIRA using your current browser session.`;
  
  if (!confirm(syncMsg)) {
    console.log('Sync cancelled by user');
    return;
  }

  showLoading();
  
  try {
    console.log('Starting JIRA sync...');
    showAlert('info', 'Sync started - fetching issues from JIRA...');
    
    // For now, just show a message
    setTimeout(() => {
      hideLoading();
      showAlert('warning', 'Sync function ready - JIRA integration to be completed');
    }, 1000);
    
  } catch (error) {
    hideLoading();
    console.error('Sync error:', error);
    showAlert('danger', `Sync failed: ${error.message}`);
  }
};

console.log('🔧 DEBUG: syncData function defined successfully');
console.log('🔧 DEBUG: window.syncData type:', typeof window.syncData);

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Global test function for debugging
window.testSyncDebug = function() {
  console.log('🧪 GLOBAL: Manual test sync triggered');
  console.log('🧪 GLOBAL: syncData function exists:', typeof window.syncData);
  if (typeof window.syncData === 'function') {
    window.syncData('debug');
  } else {
    console.error('🧪 GLOBAL: syncData function not found!');
  }
};

console.log('🔧 DEBUG: Test functions loaded. Use testSyncDebug() in console to test manually.');
console.log('🔧 DEBUG: Script execution completed successfully');
