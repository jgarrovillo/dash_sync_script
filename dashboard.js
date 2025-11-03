// NLC Integrations Dashboard - Main JavaScript
console.log('🚀 Dashboard JavaScript loaded from external file');

let allData = null;
let charts = {};
let chartData = {}; // Store chart data for re-rendering
let chartTypes = {
  environment: localStorage.getItem('chartType_environment') || 'pie',
  jurisdiction: localStorage.getItem('chartType_jurisdiction') || 'pie',
  template: localStorage.getItem('chartType_template') || 'bar'
};
let hasAutoSynced = false; // Flag to prevent auto-sync loop

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
    
    // Update summary cards
    if (data.summary) {
      document.getElementById('totalTickets').textContent = data.summary.total || 0;
      document.getElementById('todayCount').textContent = data.summary.byPeriod?.today || 0;
      document.getElementById('weekCount').textContent = data.summary.byPeriod?.thisWeek || 0;
      document.getElementById('monthCount').textContent = data.summary.byPeriod?.thisMonth || 0;
      document.getElementById('yearCount').textContent = data.summary.byPeriod?.thisYear || 0;
      document.getElementById('prevYearsCount').textContent = data.summary.byPeriod?.previousYears || 0;
    }
    
    // Render charts and tables
    if (data.summary) {
      renderPeriodChart(data.summary.byPeriod);
      renderEnvironmentChart(data.summary.byEnvironment, chartTypes.environment);
      renderJurisdictionChart(data.summary.byJurisdiction, chartTypes.jurisdiction);
      renderTemplateChart(data.summary.byTemplate, chartTypes.template);
    }
    
    if (data.tickets) {
      renderTicketsTable(data.tickets);
    }
    
    // Auto-sync delta after initial load (only if JIRA Bridge is available and hasn't already synced)
    if (isBridgeAvailable() && !hasAutoSynced) {
      console.log('🔄 Triggering auto-sync for new/updated tickets...');
      hasAutoSynced = true; // Set flag to prevent loop
      setTimeout(() => {
        syncData('delta', true); // Auto-sync without confirmation
      }, 2000); // Wait 2 seconds after page load
    }
  }

  // Chart color schemes
  const CHART_COLORS = {
    primary: '#1f6feb',
    success: '#2ea043',
    warning: '#d29922',
    danger: '#da3633',
    purple: '#8b5cf6',
    info: '#58a6ff',
    teal: '#39d0d8',
    orange: '#f0883e'
  };

  const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#e6edf3',
          font: { size: 12 }
        }
      }
    }
  };

  /**
  * Chart 1: Period Bar Chart
  * Shows tickets created by time period (Today, This Week, This Month, This Year, Previous Years)
  */
  function renderPeriodChart(periodData) {
    console.log('Rendering period chart:', periodData);
    
    const ctx = document.getElementById('periodChart');
    if (!ctx) {
      console.error('Period chart canvas not found');
      return;
    }
    
    // Destroy existing chart if it exists
    if (charts.periodChart) {
      charts.periodChart.destroy();
    }
    
    // Set canvas height to match other charts
    ctx.style.height = '550px';
    ctx.parentElement.style.minHeight = '550px';
    
    const labels = ['Today', 'This Week', 'This Month', 'This Year', 'Previous Years'];
    const dataValues = [
      periodData?.today || 0,
      periodData?.thisWeek || 0,
      periodData?.thisMonth || 0,
      periodData?.thisYear || 0,
      periodData?.previousYears || 0
    ];
    
    const backgroundColors = [
      CHART_COLORS.success,
      CHART_COLORS.warning,
      CHART_COLORS.purple,
      CHART_COLORS.primary,
      CHART_COLORS.info
    ];
    
    charts.periodChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Tickets Created',
          data: dataValues,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(c => c),
          borderWidth: 1
        }]
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#7d8590',
              stepSize: 1
            },
            grid: {
              color: '#30363d'
            }
          },
          x: {
            ticks: {
              color: '#7d8590'
            },
            grid: {
              color: '#30363d'
            }
          }
        },
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#161b22',
            titleColor: '#e6edf3',
            bodyColor: '#e6edf3',
            borderColor: '#30363d',
            borderWidth: 1
          }
        }
      }
    });
  }

  /**
  * Chart 2: Environment Chart (Bar/Pie/Doughnut)
  * Shows distribution of environments for Setup Request issues
  */
  function renderEnvironmentChart(envData, chartType) {
    console.log('Rendering environment chart:', envData, 'Type:', chartType);
    
    const ctx = document.getElementById('environmentChart');
    if (!ctx) {
      console.error('Environment chart canvas not found');
      return;
    }
    
    // Store data for re-rendering
    chartData.environment = envData;
    
    // Use stored chart type if not provided
    if (!chartType) {
      chartType = chartTypes.environment;
    }
    
    // Destroy existing chart if it exists
    if (charts.environmentChart) {
      charts.environmentChart.destroy();
    }
    
    if (!envData || Object.keys(envData).length === 0) {
      console.log('No environment data available');
      return;
    }
    
    // Sort environments alphabetically
    const sortedEntries = Object.entries(envData).sort((a, b) => a[0].localeCompare(b[0]));
    const labels = sortedEntries.map(entry => entry[0]);
    const dataValues = sortedEntries.map(entry => entry[1]);
    
    // Adjust canvas height for bar charts with many items
    if (chartType === 'bar' && labels.length > 15) {
      // Cap the height at 1000px to fit on 1080p screens
      const calculatedHeight = labels.length * 25;
      const minHeight = Math.min(Math.max(550, calculatedHeight), 1000);
      ctx.style.height = minHeight + 'px';
      ctx.parentElement.style.minHeight = minHeight + 'px';
    } else {
      ctx.style.height = '550px';
      ctx.parentElement.style.minHeight = '550px';
    }
    
    // Generate colors for each environment
    const colors = generateColors(labels.length);
    
    // Build chart configuration based on type
    const config = {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Setup Requests',
          data: dataValues,
          backgroundColor: colors,
          borderColor: chartType === 'bar' ? colors : '#161b22',
          borderWidth: chartType === 'bar' ? 1 : 2
        }]
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: {
            position: chartType === 'bar' ? 'top' : 'right',
            display: chartType !== 'bar',
            labels: {
              color: '#e6edf3',
              font: { size: 11 },
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: '#161b22',
            titleColor: '#e6edf3',
            bodyColor: '#e6edf3',
            borderColor: '#30363d',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = chartType === 'bar' ? context.parsed.y : context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    };
    
    // Add scales for bar chart
    if (chartType === 'bar') {
      config.options.scales = {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#7d8590',
            stepSize: 1
          },
          grid: {
            color: '#30363d'
          }
        },
        x: {
          ticks: {
            color: '#7d8590'
          },
          grid: {
            color: '#30363d'
          }
        }
      };
    }
    
    charts.environmentChart = new Chart(ctx, config);
  }

  /**
  * Chart 3: Compliance Jurisdiction Chart (Bar/Pie/Doughnut)
  * Shows distribution of compliance jurisdictions for Setup Request issues
  */
  function renderJurisdictionChart(jurData, chartType) {
    console.log('Rendering jurisdiction chart:', jurData, 'Type:', chartType);
    
    const ctx = document.getElementById('jurisdictionChart');
    if (!ctx) {
      console.error('Jurisdiction chart canvas not found');
      return;
    }
    
    // Store data for re-rendering
    chartData.jurisdiction = jurData;
    
    // Use stored chart type if not provided
    if (!chartType) {
      chartType = chartTypes.jurisdiction;
    }
    
    // Destroy existing chart if it exists
    if (charts.jurisdictionChart) {
      charts.jurisdictionChart.destroy();
    }
    
    if (!jurData || Object.keys(jurData).length === 0) {
      console.log('No jurisdiction data available');
      return;
    }
    
    // Group jurisdictions by country
    const groupedData = {};
    
    Object.entries(jurData).forEach(([rawLabel, count]) => {
      // Remove BODATA reference
      const cleanLabel = rawLabel.includes('(BODATA-') 
        ? rawLabel.split('(')[0].trim() 
        : rawLabel;
      
      // Check if label contains a comma (country, state/province format)
      if (cleanLabel.includes(',')) {
        const parts = cleanLabel.split(',').map(p => p.trim());
        const country = parts[0];
        const region = parts.slice(1).join(', '); // Handle cases with multiple commas
        
        // Group by country
        if (!groupedData[country]) {
          groupedData[country] = { total: 0, regions: {} };
        }
        groupedData[country].total += count;
        groupedData[country].regions[region] = (groupedData[country].regions[region] || 0) + count;
      } else {
        // No comma, treat as standalone country
        if (!groupedData[cleanLabel]) {
          groupedData[cleanLabel] = { total: 0, regions: {} };
        }
        groupedData[cleanLabel].total += count;
      }
    });
    
    // Build labels and data arrays with hierarchical grouping
    const labels = [];
    const dataValues = [];
    
    // Sort countries alphabetically
    const sortedCountries = Object.keys(groupedData).sort((a, b) => a.localeCompare(b));
    
    sortedCountries.forEach(country => {
      const countryData = groupedData[country];
      const regions = Object.keys(countryData.regions);
      
      if (regions.length === 0) {
        // Country with no regions - show as-is
        labels.push(country);
        dataValues.push(countryData.total);
      } else {
        // Country with regions - show all with visual hierarchy
        // Don't show country total, just the regions grouped under it
        
        // Sort regions alphabetically
        const sortedRegions = regions.sort((a, b) => a.localeCompare(b));
        sortedRegions.forEach(region => {
          // Show as "Country ├─ Region" for visual grouping
          labels.push(`${country} ├─ ${region}`);
          dataValues.push(countryData.regions[region]);
        });
      }
    });
    
    // Adjust canvas height for bar charts with many items
    if (chartType === 'bar' && labels.length > 15) {
      // Cap the height at 1000px to fit on 1080p screens
      const calculatedHeight = labels.length * 25;
      const minHeight = Math.min(Math.max(550, calculatedHeight), 1000);
      ctx.style.height = minHeight + 'px';
      ctx.parentElement.style.minHeight = minHeight + 'px';
    } else {
      ctx.style.height = '550px';
      ctx.parentElement.style.minHeight = '550px';
    }
    
    // Generate colors for each jurisdiction
    const colors = generateColors(labels.length);
    
    // Build chart configuration based on type
    const config = {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Setup Requests',
          data: dataValues,
          backgroundColor: colors,
          borderColor: chartType === 'bar' ? colors : '#161b22',
          borderWidth: chartType === 'bar' ? 1 : 2
        }]
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: {
            position: chartType === 'bar' ? 'top' : 'right',
            display: chartType !== 'bar',
            labels: {
              color: '#e6edf3',
              font: { size: 11 },
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: '#161b22',
            titleColor: '#e6edf3',
            bodyColor: '#e6edf3',
            borderColor: '#30363d',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = chartType === 'bar' ? context.parsed.y : context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    };
    
    // Add scales for bar chart
    if (chartType === 'bar') {
      config.options.scales = {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#7d8590',
            stepSize: 1
          },
          grid: {
            color: '#30363d'
          }
        },
        x: {
          ticks: {
            color: '#7d8590'
          },
          grid: {
            color: '#30363d'
          }
        }
      };
    }
    
    charts.jurisdictionChart = new Chart(ctx, config);
  }

  /**
  * Chart 4: Template Chart (Bar/Pie/Doughnut)
  * Shows distribution of templates (ISR - NLC Setup, ISR - Evo OSS Setup) for Setup Request issues
  */
  function renderTemplateChart(templateData, chartType) {
    console.log('Rendering template chart:', templateData, 'Type:', chartType);
    
    const ctx = document.getElementById('templateChart');
    if (!ctx) {
      console.error('Template chart canvas not found');
      return;
    }
    
    // Store data for re-rendering
    chartData.template = templateData;
    
    // Use stored chart type if not provided
    if (!chartType) {
      chartType = chartTypes.template;
    }
    
    // Destroy existing chart if it exists
    if (charts.templateChart) {
      charts.templateChart.destroy();
    }
    
    if (!templateData || Object.keys(templateData).length === 0) {
      console.log('No template data available');
      return;
    }
    
    const labels = Object.keys(templateData);
    const dataValues = Object.values(templateData);
    
    // Adjust canvas height for bar charts with many items
    if (chartType === 'bar' && labels.length > 15) {
      // Cap the height at 1000px to fit on 1080p screens
      const calculatedHeight = labels.length * 25;
      const minHeight = Math.min(Math.max(550, calculatedHeight), 1000);
      ctx.style.height = minHeight + 'px';
      ctx.parentElement.style.minHeight = minHeight + 'px';
    } else {
      ctx.style.height = '550px';
      ctx.parentElement.style.minHeight = '550px';
    }
    
    // Use specific colors for templates
    const colors = [
      CHART_COLORS.primary,
      CHART_COLORS.success,
      CHART_COLORS.warning,
      CHART_COLORS.purple,
      CHART_COLORS.info
    ].slice(0, labels.length);
    
    // Build chart configuration based on type
    const config = {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Setup Requests',
          data: dataValues,
          backgroundColor: colors,
          borderColor: chartType === 'bar' ? colors : '#161b22',
          borderWidth: chartType === 'bar' ? 1 : 2
        }]
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: {
            position: chartType === 'bar' ? 'top' : 'right',
            display: chartType !== 'bar',
            labels: {
              color: '#e6edf3',
              font: { size: 11 },
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: '#161b22',
            titleColor: '#e6edf3',
            bodyColor: '#e6edf3',
            borderColor: '#30363d',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = chartType === 'bar' ? (config.options.indexAxis === 'y' ? context.parsed.x : context.parsed.y) : context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    };
    
    // Add scales and orientation for bar chart
    if (chartType === 'bar') {
      config.options.indexAxis = 'y'; // Horizontal bar chart for better label readability
      config.options.scales = {
        x: {
          beginAtZero: true,
          ticks: {
            color: '#7d8590',
            stepSize: 1
          },
          grid: {
            color: '#30363d'
          }
        },
        y: {
          ticks: {
            color: '#7d8590',
            font: { size: 10 }
          },
          grid: {
            color: '#30363d'
          }
        }
      };
    }
    
    charts.templateChart = new Chart(ctx, config);
  }

  /**
  * Helper function to generate distinct colors for charts
  */
  function generateColors(count) {
    const baseColors = [
      CHART_COLORS.primary,
      CHART_COLORS.success,
      CHART_COLORS.warning,
      CHART_COLORS.purple,
      CHART_COLORS.info,
      CHART_COLORS.teal,
      CHART_COLORS.orange,
      CHART_COLORS.danger
    ];
    
    // If we need more colors than base colors, generate variations
    if (count <= baseColors.length) {
      return baseColors.slice(0, count);
    }
    
    const colors = [...baseColors];
    const hueStep = 360 / count;
    
    for (let i = baseColors.length; i < count; i++) {
      const hue = (i * hueStep) % 360;
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    
    return colors;
  }

  // Pagination state
  let currentPage = 1;
  let itemsPerPage = 25;
  let filteredTickets = [];
  let allTickets = [];

  function renderTicketsTable(tickets) {
    allTickets = tickets;
    filteredTickets = tickets;
    currentPage = 1;
    
    // Populate filter dropdowns dynamically
    populateFilterDropdowns(tickets);
    
    // Set up search and filter handlers
    setupTableFilters();
    
    // Set up column resizing
    setupColumnResizing();
    
    // Initial render
    updateTicketsTable();
  }

  /**
   * Populate filter dropdowns with unique values from data
   */
  function populateFilterDropdowns(tickets) {
    // Get unique values for each filter
    const types = [...new Set(tickets.map(t => t.issueType).filter(Boolean))].sort();
    const statuses = [...new Set(tickets.map(t => t.status).filter(Boolean))].sort();
    const environments = [...new Set(tickets.map(t => t.environments).filter(Boolean))].sort();
    const templates = [...new Set(tickets.map(t => t.template).filter(Boolean))].sort();
    
    // Populate Type filter
    const typeSelect = document.getElementById('filterType');
    if (typeSelect) {
      typeSelect.innerHTML = '<option value="">All Types</option>' + 
        types.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('');
    }
    
    // Populate Status filter
    const statusSelect = document.getElementById('filterStatus');
    if (statusSelect) {
      statusSelect.innerHTML = '<option value="">All Statuses</option>' + 
        statuses.map(status => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join('');
    }
    
    // Populate Environment filter
    const envSelect = document.getElementById('filterEnvironment');
    if (envSelect) {
      envSelect.innerHTML = '<option value="">All Environments</option>' + 
        environments.map(env => `<option value="${escapeHtml(env)}">${escapeHtml(env)}</option>`).join('');
    }
    
    // Populate Template filter
    const templateSelect = document.getElementById('filterTemplate');
    if (templateSelect) {
      templateSelect.innerHTML = '<option value="">All Templates</option>' + 
        templates.map(template => `<option value="${escapeHtml(template)}">${escapeHtml(template)}</option>`).join('');
    }
  }

  function setupTableFilters() {
    const searchInput = document.getElementById('ticketSearch');
    const filterSelects = document.querySelectorAll('.ticket-filter');
    
    if (searchInput) {
      searchInput.addEventListener('input', applyFilters);
    }
    
    filterSelects.forEach(select => {
      select.addEventListener('change', applyFilters);
    });
  }

  function applyFilters() {
    const searchTerm = document.getElementById('ticketSearch')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('filterType')?.value || '';
    const statusFilter = document.getElementById('filterStatus')?.value || '';
    const environmentFilter = document.getElementById('filterEnvironment')?.value || '';
    const templateFilter = document.getElementById('filterTemplate')?.value || '';
    
    filteredTickets = allTickets.filter(ticket => {
      const matchesSearch = !searchTerm || 
        ticket.issueKey.toLowerCase().includes(searchTerm) ||
        ticket.summary.toLowerCase().includes(searchTerm) ||
        (ticket.environments && ticket.environments.toLowerCase().includes(searchTerm)) ||
        (ticket.complianceJurisdiction && ticket.complianceJurisdiction.toLowerCase().includes(searchTerm)) ||
        (ticket.template && ticket.template.toLowerCase().includes(searchTerm));
      
      const matchesType = !typeFilter || ticket.issueType === typeFilter;
      const matchesStatus = !statusFilter || ticket.status === statusFilter;
      const matchesEnvironment = !environmentFilter || ticket.environments === environmentFilter;
      const matchesTemplate = !templateFilter || ticket.template === templateFilter;
      
      return matchesSearch && matchesType && matchesStatus && matchesEnvironment && matchesTemplate;
    });
    
    currentPage = 1;
    updateTicketsTable();
  }

  /**
   * Setup column resizing functionality
   */
  function setupColumnResizing() {
    const table = document.querySelector('.table');
    if (!table) return;
    
    const headers = table.querySelectorAll('th');
    
    headers.forEach((header, index) => {
      // Add resizer element
      const resizer = document.createElement('div');
      resizer.className = 'resizer';
      header.appendChild(resizer);
      
      let startX, startWidth;
      
      resizer.addEventListener('mousedown', function(e) {
        startX = e.pageX;
        startWidth = header.offsetWidth;
        header.classList.add('resizing');
        
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        
        e.preventDefault();
      });
      
      function resize(e) {
        const width = startWidth + (e.pageX - startX);
        if (width > 50) { // Minimum width
          header.style.width = width + 'px';
          header.style.minWidth = width + 'px';
          header.style.maxWidth = width + 'px';
        }
      }
      
      function stopResize() {
        header.classList.remove('resizing');
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
      }
    });
  }

  /**
   * Get appropriate badge class for ticket status
   */
  function getStatusBadgeClass(status) {
    // Log the status being processed
    console.log('Processing status:', status, 'Type:', typeof status);
    
    const statusMap = {
      'To Do': 'bg-secondary',           // Gray - not started
      'In Progress': 'bg-primary',       // Blue - actively working
      'Done': 'bg-success',              // Green - completed
      'On Hold': 'bg-warning',           // Yellow - paused
      'Cancelled': 'bg-danger'           // Red - cancelled
    };
    
    const result = statusMap[status] || 'bg-secondary';
    console.log('Status:', status, '-> Class:', result);
    return result;
  }

  function updateTicketsTable() {
    const tbody = document.getElementById('ticketsTable');
    
    if (filteredTickets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No tickets found</td></tr>';
      updatePagination(0);
      return;
    }
    
    // Sort by created date (newest first)
    const sorted = [...filteredTickets].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    
    // Paginate
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageTickets = sorted.slice(startIndex, endIndex);
    
    const html = pageTickets.map(function(ticket) {
      // Clean up summary by removing template prefixes
      let cleanSummary = ticket.summary;
      const prefixesToRemove = [
        'ISR - NLC Setup on ',
        'ISR - Evo OSS Setup on ',
        'ISR - NLC Setup ',
        'ISR - Evo OSS Setup ',
        'ICR - NLC Change on ',
        'ICR - Evo OSS Change on ',
        'ICR - NLC Change ',
        'ICR - Evo OSS Change '
      ];
      for (const prefix of prefixesToRemove) {
        if (cleanSummary.startsWith(prefix)) {
          cleanSummary = cleanSummary.substring(prefix.length);
          break;
        }
      }
      
      // Format date to CET (UTC+1)
      let formattedDate = '';
      if (ticket.createdDate) {
        try {
          const date = new Date(ticket.createdDate);
          // Convert to CET (UTC+1)
          const cetDate = new Date(date.getTime() + (60 * 60 * 1000));
          const year = cetDate.getUTCFullYear();
          const month = String(cetDate.getUTCMonth() + 1).padStart(2, '0');
          const day = String(cetDate.getUTCDate()).padStart(2, '0');
          const hours = String(cetDate.getUTCHours()).padStart(2, '0');
          const minutes = String(cetDate.getUTCMinutes()).padStart(2, '0');
          formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;
        } catch (e) {
          formattedDate = ticket.createdDate;
        }
      }
      
      // Clean up jurisdiction by removing BODATA references
      let cleanJurisdiction = ticket.complianceJurisdiction || '';
      if (cleanJurisdiction.includes('(BODATA-')) {
        cleanJurisdiction = cleanJurisdiction.split('(')[0].trim();
      }
      
      return `<tr>
        <td><span class="badge bg-info">${escapeHtml(ticket.issueType)}</span></td>
        <td><a href="https://jira.evolution.com/browse/${escapeHtml(ticket.issueKey)}" target="_blank" class="text-decoration-none">
          <strong>${escapeHtml(ticket.issueKey)}</strong>
          <i class="bi bi-box-arrow-up-right ms-1" style="font-size: 0.8em;"></i>
        </a></td>
        <td><small>${escapeHtml(ticket.template || '')}</small></td>
        <td>${escapeHtml(cleanSummary)}</td>
        <td><small>${escapeHtml(formattedDate)}</small></td>
        <td><small>${escapeHtml(ticket.environments || '')}</small></td>
        <td><small>${escapeHtml(cleanJurisdiction)}</small></td>
        <td><span class="badge ${getStatusBadgeClass(ticket.status.trim())}" style="min-width: 100px; display: inline-block;">${escapeHtml(ticket.status)}</span></td>
      </tr>`;
    }).join('');
    
    tbody.innerHTML = html;
    updatePagination(sorted.length);
  }

  function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationContainer = document.getElementById('tablePagination');
    
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }
    
    let html = '<nav><ul class="pagination pagination-sm mb-0">';
    
    // Previous button
    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">Previous</a>
    </li>`;
    
    // Page numbers (show max 5 pages)
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
      html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
        <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
      </li>`;
    }
    
    // Next button
    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">Next</a>
    </li>`;
    
    html += '</ul></nav>';
    html += `<small class="text-muted ms-3">Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems}</small>`;
    
    paginationContainer.innerHTML = html;
  }

  window.changePage = function(page) {
    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    updateTicketsTable();
  };

  /**
   * Change chart type and re-render
   */
  window.changeChartType = function(chartName, newType) {
    console.log(`Changing ${chartName} chart to ${newType}`);
    
    // Update stored chart type
    chartTypes[chartName] = newType;
    localStorage.setItem(`chartType_${chartName}`, newType);
    
    // Update button states
    const buttons = document.querySelectorAll(`[onclick*="changeChartType('${chartName}'"`);
    buttons.forEach(btn => {
      if (btn.onclick.toString().includes(`'${newType}'`)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // Re-render the chart with stored data
    if (chartData[chartName]) {
      switch(chartName) {
        case 'environment':
          renderEnvironmentChart(chartData.environment, newType);
          break;
        case 'jurisdiction':
          renderJurisdictionChart(chartData.jurisdiction, newType);
          break;
        case 'template':
          renderTemplateChart(chartData.template, newType);
          break;
      }
    }
  };

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

  window.syncData = async function syncData(type, autoSync = false) {
    console.log(`🚀 [syncData] Starting sync with type: ${type}, autoSync: ${autoSync}`);
    console.log(`🚀 [syncData] Function called at: ${new Date().toISOString()}`);
    
    const isDebug = type === 'debug';
    const isDelta = type === 'delta';
    
    // Build appropriate confirmation message
    let syncMsg;
    if (isDebug) {
      syncMsg = 'Test sync with 10 most recent issues?\n\nThis will fetch a small dataset for testing purposes.';
    } else if (isDelta) {
      syncMsg = 'Sync new/updated tickets from JIRA?\n\nThis will only fetch tickets created or updated in the last 7 days.';
    } else {
      syncMsg = 'Sync ALL tickets from JIRA?\n\nThis will fetch ALL data directly from JIRA.\n\nNote: This may take a few minutes for large datasets (3000+ issues).';
    }
    
    // Skip confirmation for auto-sync
    if (!autoSync && !confirm(syncMsg)) {
      console.log('Sync cancelled by user');
      return;
    }

    showLoading();
    
    try {
      console.log('🔍 Checking JIRA Bridge availability...');
      
      if (!isBridgeAvailable()) {
        hideLoading();
        if (!autoSync) {
          showAlert('danger', 'JIRA Bridge extension not detected. Please install the extension and refresh.');
        }
        return;
      }
      
      console.log(`✅ JIRA Bridge available, fetching issues...`);
      showAlert('info', 'Fetching field metadata from JIRA...');

      // First, fetch all field definitions to get custom field names
      console.log('📋 Fetching field metadata...');
      let fieldNames = {};
      
      try {
        const fieldsData = await window.JiraBridge.fetch(
          `https://${JIRA_CONFIG.domain}/rest/api/2/field`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          }
        );
        
        if (fieldsData && Array.isArray(fieldsData)) {
          fieldsData.forEach(field => {
            if (field.id && field.name) {
              fieldNames[field.id] = field.name;
            }
          });
          console.log(`✅ Fetched ${Object.keys(fieldNames).length} field definitions`);
          console.log('Sample fields:', Object.entries(fieldNames).slice(0, 5).map(([k,v]) => `${v}=${k}`).join(', '));
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch field metadata:', error);
      }

      // Build JQL query based on sync type
      let jql;
      if (isDelta) {
        // Only fetch tickets created or updated in the last 7 days
        jql = `project = ${JIRA_CONFIG.projectKey} AND (created >= -7d OR updated >= -7d) ORDER BY updated DESC`;
        console.log('📋 Delta sync: Fetching tickets from last 7 days');
      } else {
        jql = `project = ${JIRA_CONFIG.projectKey} ORDER BY created DESC`;
        console.log('📋 Full sync: Fetching all tickets');
      }

      console.log(`📋 JQL Query: ${jql}`);
      console.log(`🌐 Fetching from: https://${JIRA_CONFIG.domain}/rest/api/2/search`);
      showAlert('info', 'Fetching issues from JIRA...');

      // Fetch ALL issues with pagination
      let allIssues = [];
      let startAt = 0;
      const maxResults = isDebug ? 10 : 100; // Fetch in batches of 100
      let totalIssues = 0;
      
      do {
        console.log(`🔄 Fetching batch starting at ${startAt}...`);
        
        const data = await window.JiraBridge.fetch(
          `https://${JIRA_CONFIG.domain}/rest/api/2/search`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              jql: jql,
              startAt: startAt,
              maxResults: maxResults
              // Don't specify fields parameter - this will return ALL fields including custom fields
            })
          }
        );
        
        console.log(`📦 Batch received: ${data.issues ? data.issues.length : 0} issues`);
        
        if (data.issues && data.issues.length > 0) {
          allIssues = allIssues.concat(data.issues);
          totalIssues = data.total;
          
          console.log(`📊 Progress: ${allIssues.length} / ${totalIssues} issues fetched`);
          
          // Update progress
          showAlert('info', `Fetching issues: ${allIssues.length} / ${totalIssues}...`);
        }
        
        startAt += maxResults;
        
        // Safety check: stop if we've fetched more than expected or hit JIRA's limit
        if (startAt > 10000) {
          console.warn('⚠️ Reached JIRA\'s 10,000 issue limit');
          break;
        }
        
        // For debug mode, only fetch one batch
        if (isDebug) {
          console.log('🐛 Debug mode: stopping after first batch');
          break;
        }
        
        // Check if we need to continue
        const shouldContinue = allIssues.length < totalIssues;
        console.log(`🔄 Should continue? ${shouldContinue} (${allIssues.length} < ${totalIssues})`);
        
      } while (allIssues.length < totalIssues);
      
      console.log(`✅ Fetched ${allIssues.length} total issues from JIRA`);
      console.log(`📋 Total field names collected: ${Object.keys(fieldNames).length}`);
      
      if (allIssues.length === 0) {
        hideLoading();
        showAlert('warning', 'No issues found matching the criteria');
        return;
      }
      
      if (Object.keys(fieldNames).length === 0) {
        console.warn('⚠️ WARNING: No field names received from JIRA! Custom fields will be empty.');
        showAlert('warning', 'Warning: No field name mappings received. Custom fields may be empty.');
      }
      
      console.log('💾 Sending data to Google Sheets...');
      showAlert('info', `Processing ${allIssues.length} issues in batches...`);
      
      // Send to backend in batches to avoid payload size limits
      const BATCH_SIZE = 100; // Process 100 issues at a time
      const totalBatches = Math.ceil(allIssues.length / BATCH_SIZE);
      let processedBatches = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      
      console.log(`📤 Sending ${allIssues.length} issues in ${totalBatches} batches of ${BATCH_SIZE}`);
      
      async function processBatch(batchIndex) {
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, allIssues.length);
        const batch = allIssues.slice(startIdx, endIdx);
        
        console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (issues ${startIdx + 1}-${endIdx})`);
        showAlert('info', `Processing batch ${batchIndex + 1}/${totalBatches}...`);
        
        return new Promise((resolve, reject) => {
          google.script.run
            .withSuccessHandler(function(result) {
              if (result && result.success) {
                processedBatches++;
                totalInserted += result.inserted || 0;
                totalUpdated += result.updated || 0;
                console.log(`✅ Batch ${batchIndex + 1} complete: ${result.inserted} inserted, ${result.updated} updated`);
                resolve(result);
              } else {
                reject(new Error(result ? result.message : 'Unknown error'));
              }
            })
            .withFailureHandler(function(error) {
              console.error(`❌ Batch ${batchIndex + 1} failed:`, error);
              reject(error);
            })
            .storeJiraDataFromBrowser(batch, fieldNames);
        });
      }
      
      // Process all batches sequentially
      try {
        for (let i = 0; i < totalBatches; i++) {
          await processBatch(i);
        }
        
        hideLoading();
        const finalMessage = `✅ Sync complete! ${totalInserted} inserted, ${totalUpdated} updated (${allIssues.length} total issues)`;
        console.log(finalMessage);
        showAlert('success', finalMessage);
        
        // Reload dashboard to show new data
        setTimeout(() => loadDashboard(), 1000);
        
      } catch (error) {
        hideLoading();
        console.error('❌ Batch processing error:', error);
        showAlert('danger', `❌ Sync failed after ${processedBatches} batches: ${error.message}`);
      }
      
    } catch (error) {
      hideLoading();
      console.error('❌ Sync error:', error);
      showAlert('danger', `❌ Sync failed: ${error.message}`);
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
