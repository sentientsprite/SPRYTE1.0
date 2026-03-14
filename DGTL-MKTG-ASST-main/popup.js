// Popup script for AI Growth Coach Extension
// Handles UI interactions and data display

// Promise wrappers for chrome.storage to ensure await works across environments
function storageGet(keys) {
  return new Promise(resolve => chrome.storage.sync.get(keys, resolve));
}

function storageSet(obj) {
  return new Promise(resolve => chrome.storage.sync.set(obj, resolve));
}

class AIGrowthCoach {
  constructor() {
    this.currentTab = 'insights';
    this.analyticsData = null;
    this.isAuthenticated = false;
    this.propertyId = null;
    this.charts = {};
    
    // Expose instance globally so other handlers (resize etc.) can access charts
    window.aiGrowthCoach = this;

    this.init();
  }
  
  async init() {
    this.setupEventListeners();
    await this.checkFirstRun();
    await this.checkAuthentication();
    this.loadCurrentTab();
  }
  
  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });
    
    // Toggle switch
    document.getElementById('activeToggle').addEventListener('click', this.toggleActiveMode.bind(this));
    
    // Footer buttons
    document.getElementById('exportBtn').addEventListener('click', this.exportToSheets.bind(this));
    document.getElementById('privacyBtn').addEventListener('click', this.showPrivacy.bind(this));
    document.getElementById('upgradeBtn').addEventListener('click', this.showUpgrade.bind(this));
    
    // Consent modal
    document.getElementById('consentAccept').addEventListener('click', this.acceptConsent.bind(this));
    document.getElementById('consentDecline').addEventListener('click', this.showPrivacy.bind(this));

    // Settings modal
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => {
      document.getElementById('settingsModal').classList.remove('hidden');
      document.getElementById('settingsPropertyId').value = this.propertyId || '';
      // Load saved client id
      storageGet(['oauthClientId']).then(res => {
        document.getElementById('settingsClientId').value = res.oauthClientId || '';
      });
      // populate redirect URI using chrome.identity.getRedirectURL()
      try {
        const redirectField = document.getElementById('redirectUri');
        redirectField.value = chrome.identity.getRedirectURL();
      } catch (e) {
        document.getElementById('redirectHelp').textContent = 'Unable to determine redirect URI in this environment.';
      }
    });
    // copy redirect URI
    document.getElementById('copyRedirect').addEventListener('click', () => {
      const redirect = document.getElementById('redirectUri').value;
      if (!redirect) return;
      navigator.clipboard.writeText(redirect).then(() => {
        const orig = document.getElementById('copyRedirect').textContent;
        document.getElementById('copyRedirect').textContent = 'Copied';
        setTimeout(() => document.getElementById('copyRedirect').textContent = orig, 1500);
      });
    });
    // Test OAuth button
    document.getElementById('testAuth').addEventListener('click', async () => {
      const clientId = document.getElementById('settingsClientId').value.trim();
      if (!clientId) {
        alert('Please enter an OAuth Client ID first.');
        return;
      }
      // show quick status
      const btn = document.getElementById('testAuth');
      const origText = btn.textContent;
      btn.textContent = 'Testing...';
      btn.disabled = true;
      try {
        // save clientId then attempt authenticate which will use it
        await storageSet({ oauthClientId: clientId });
        const response = await this.sendMessage({ action: 'authenticate', clientId });
        if (response.success) {
          alert('OAuth test succeeded — token acquired.');
        } else {
          alert('OAuth test failed: ' + (response.error || 'Unknown error'));
        }
      } catch (err) {
        alert('OAuth test error: ' + (err.message || err));
      } finally {
        btn.textContent = origText;
        btn.disabled = false;
      }
    });
    document.getElementById('settingsClose').addEventListener('click', () => {
      document.getElementById('settingsModal').classList.add('hidden');
    });
    document.getElementById('settingsSave').addEventListener('click', async () => {
      const propertyId = document.getElementById('settingsPropertyId').value.trim();
      const clientId = document.getElementById('settingsClientId').value.trim();
      if (propertyId) {
        await storageSet({ propertyId });
        this.propertyId = propertyId;
      }
      if (clientId) {
        await storageSet({ oauthClientId: clientId });
      }
      document.getElementById('settingsModal').classList.add('hidden');
      this.loadAnalyticsData();
    });
  }
  
  async checkFirstRun() {
  const { hasSeenConsent } = await storageGet(['hasSeenConsent']);
    if (!hasSeenConsent) {
      document.getElementById('consentModal').classList.remove('hidden');
    }
  }
  
  async acceptConsent() {
  await storageSet({ hasSeenConsent: true });
    document.getElementById('consentModal').classList.add('hidden');
  }
  
  async checkAuthentication() {
  const { authToken, propertyId } = await storageGet(['authToken', 'propertyId']);
    this.isAuthenticated = !!authToken;
    this.propertyId = propertyId;
    
    if (this.isAuthenticated) {
      this.loadAnalyticsData();
    }
  }
  
  async loadAnalyticsData() {
    if (!this.propertyId) {
      this.showPropertySetup();
      return;
    }
    
    this.showLoading();
    
    try {
      const response = await this.sendMessage({
        action: 'getAnalytics',
        propertyId: this.propertyId
      });
      
      if (response.success) {
        this.analyticsData = response.data;
        this.loadCurrentTab();
      } else {
        this.showError(response.error);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      this.showError('Failed to load your analytics data');
    }
  }
  
  switchTab(tabName) {
    // Update tab UI
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    this.currentTab = tabName;
    this.loadCurrentTab();
  }
  
  loadCurrentTab() {
    const content = document.getElementById('content');
    
    switch (this.currentTab) {
      case 'insights':
        this.renderInsights(content);
        break;
      case 'visuals':
        this.renderVisuals(content);
        break;
      case 'chat':
        this.renderChat(content);
        break;
    }
  }
  
  renderInsights(container) {
    if (!this.isAuthenticated) {
      this.showAuthPrompt(container);
      return;
    }
    
    if (!this.analyticsData) {
      this.showLoading(container);
      return;
    }
    
    let html = '';
    
    // Show mock data notice if applicable
    if (this.analyticsData.isMockData) {
      html += `
        <div class="mock-data-notice">
          📊 Using demo data - Connect your Google Analytics for real insights!
        </div>
      `;
    }
    
    // Render insights
    this.analyticsData.insights.forEach(insight => {
      html += `
        <div class="insight-card ${insight.type}">
          <div class="insight-title">${insight.title}</div>
          <div class="insight-message">${insight.message}</div>
          <div class="insight-action">${insight.action}</div>
        </div>
      `;
    });
    
    if (this.analyticsData.insights.length === 0) {
      html += `
        <div class="insight-card">
          <div class="insight-title">🎯 Getting Started</div>
          <div class="insight-message">Hey there! I'm analyzing your data to find growth opportunities.</div>
          <div class="insight-action">Check back in a few days as I gather more information about your traffic patterns.</div>
        </div>
      `;
    }
    
    container.innerHTML = html;
  }
  
  renderVisuals(container) {
    if (!this.isAuthenticated) {
      this.showAuthPrompt(container);
      return;
    }
    
    if (!this.analyticsData) {
      this.showLoading(container);
      return;
    }
    
    let html = '';
    
    if (this.analyticsData.isMockData) {
      html += `
        <div class="mock-data-notice">
          📊 Demo charts - Connect GA for your real data visualizations!
        </div>
      `;
    }
    
    html += `
      <div class="chart-container">
        <div class="chart-title">📈 Traffic Trends (Last 30 Days)</div>
        <canvas id="trafficChart" width="360" height="200"></canvas>
      </div>
      
      <div class="chart-container">
        <div class="chart-title">🎯 Traffic Sources</div>
        <canvas id="sourcesChart" width="360" height="200"></canvas>
      </div>
    `;
    
    container.innerHTML = html;
    
    // Render charts after DOM update
    setTimeout(() => {
      this.renderTrafficChart();
      this.renderSourcesChart();
    }, 100);
  }
  
  renderTrafficChart() {
    const ctx = document.getElementById('trafficChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (this.charts.traffic) {
      this.charts.traffic.destroy();
    }
    
    const data = this.analyticsData.raw.sessions;
    const labels = data.map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (data.length - 1 - i));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    this.charts.traffic = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Sessions',
          data: data,
          borderColor: '#4facfe',
          backgroundColor: 'rgba(79, 172, 254, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
  
  renderSourcesChart() {
    const ctx = document.getElementById('sourcesChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (this.charts.sources) {
      this.charts.sources.destroy();
    }
    
    const sources = this.analyticsData.raw.sources;
    const labels = Object.keys(sources).map(key => 
      key.charAt(0).toUpperCase() + key.slice(1)
    );
    const data = Object.values(sources);
    const colors = [
      '#4facfe',
      '#00f2fe', 
      '#ffd89b',
      '#19547b',
      '#667eea'
    ];
    
    this.charts.sources = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              fontSize: 12
            }
          }
        }
      }
    });
  }
  
  renderChat(container) {
    if (!this.isAuthenticated) {
      this.showAuthPrompt(container);
      return;
    }
    
    const html = `
      <div class="chat-container">
        <div class="chat-input-group">
          <input 
            type="text" 
            class="chat-input" 
            id="chatInput" 
            placeholder="Ask about your traffic, bounce rate, sources..."
          >
          <button class="chat-submit" id="chatSubmit">Ask</button>
        </div>
        <div id="chatResponse"></div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // Setup chat functionality
    const input = document.getElementById('chatInput');
    const submit = document.getElementById('chatSubmit');
    const response = document.getElementById('chatResponse');
    
    const handleSubmit = async () => {
      const question = input.value.trim();
      if (!question) return;
      
      if (!this.analyticsData) {
        response.innerHTML = `
          <div class="chat-response">
            Hey! I need to analyze your data first. Please connect your Google Analytics or wait for the data to load.
          </div>
        `;
        return;
      }
      
      // Show loading
      response.innerHTML = `
        <div class="chat-response">
          <div class="loading-spinner"></div>
          Thinking about your question...
        </div>
      `;
      
      try {
        const result = await this.sendMessage({
          action: 'askQuestion',
          question: question,
          data: this.analyticsData
        });
        
        if (result.success) {
          response.innerHTML = `
            <div class="chat-response">
              ${result.answer}
            </div>
          `;
        } else {
          response.innerHTML = `
            <div class="chat-response">
              Sorry, I couldn't process that question. Try asking about traffic trends, bounce rates, or traffic sources.
            </div>
          `;
        }
      } catch (error) {
        response.innerHTML = `
          <div class="chat-response">
            Oops! Something went wrong. Please try asking your question again.
          </div>
        `;
      }
      
      input.value = '';
    };
    
    submit.addEventListener('click', handleSubmit);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSubmit();
    });
    
    // Show initial message if we have data
    if (this.analyticsData) {
      const totalSessions = this.analyticsData.raw.sessions.reduce((a, b) => a + b, 0);
      response.innerHTML = `
        <div class="chat-response">
          👋 Hey! I've analyzed your last 30 days of data (${totalSessions} total sessions). 
          Ask me anything about your traffic patterns, bounce rates, or where your visitors come from!
          <br><br>
          Try: "Why is my traffic dropping?" or "What's my best traffic source?"
        </div>
      `;
    }
  }
  
  showAuthPrompt(container) {
    container.innerHTML = `
      <div class="auth-prompt">
        <h3>🔐 Connect Your Analytics</h3>
        <p style="margin: 15px 0; font-size: 14px; color: #6c757d;">
          Connect your Google Analytics to get personalized insights and recommendations.
        </p>
        <button class="auth-btn" id="authButton">
          Connect Google Analytics
        </button>
      </div>
    `;
    
    document.getElementById('authButton').addEventListener('click', this.authenticate.bind(this));
  }
  
  showLoading(container = null) {
    const html = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Analyzing your data...</p>
      </div>
    `;
    
    if (container) {
      container.innerHTML = html;
    } else {
      document.getElementById('content').innerHTML = html;
    }
  }
  
  showError(message) {
    document.getElementById('content').innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #dc3545;">
        <h3>⚠️ Something went wrong</h3>
        <p style="margin: 15px 0;">${message}</p>
        <button class="auth-btn" onclick="location.reload()">Try Again</button>
      </div>
    `;
  }
  
  showPropertySetup() {
    document.getElementById('content').innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <h3>📊 Setup Analytics</h3>
        <p style="margin: 15px 0; font-size: 14px; color: #6c757d;">
          Enter your Google Analytics Property ID to get started.
        </p>
        <input 
          type="text" 
          id="propertyInput" 
          placeholder="e.g., 123456789" 
          style="width: 200px; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px; margin: 10px;"
        >
        <br>
        <button class="auth-btn" id="saveProperty" style="margin-top: 10px;">
          Save & Continue
        </button>
      </div>
    `;
    
    document.getElementById('saveProperty').addEventListener('click', async () => {
      const propertyId = document.getElementById('propertyInput').value.trim();
      if (propertyId) {
        await storageSet({ propertyId });
        this.propertyId = propertyId;
        this.loadAnalyticsData();
      }
    });
  }
  
  async authenticate() {
    try {
      this.showLoading();
  // include client id from settings if present
  const { oauthClientId } = await storageGet(['oauthClientId']);
  const response = await this.sendMessage({ action: 'authenticate', clientId: oauthClientId });
      
      if (response.success) {
        this.isAuthenticated = true;
        this.loadAnalyticsData();
      } else {
        this.showError('Failed to authenticate with Google');
      }
    } catch (error) {
      this.showError('Authentication failed. Please try again.');
    }
  }
  
  toggleActiveMode() {
    const toggle = document.getElementById('activeToggle');
    toggle.classList.toggle('active');
    
    // Could implement actual functionality here
    console.log('Active mode toggled:', toggle.classList.contains('active'));
  }
  
  async exportToSheets() {
    if (!this.analyticsData) {
      alert('No data to export. Please connect your Google Analytics first.');
      return;
    }
    
    // Stub implementation - log the data that would be exported
    console.log('Exporting to Google Sheets:', {
      insights: this.analyticsData.insights,
      sessions: this.analyticsData.raw.sessions,
      sources: this.analyticsData.raw.sources,
      exportDate: new Date().toISOString()
    });
    
    // Show user feedback
    const originalText = document.getElementById('exportBtn').textContent;
    document.getElementById('exportBtn').textContent = '✅ Exported!';
    
    setTimeout(() => {
      document.getElementById('exportBtn').textContent = originalText;
    }, 2000);
  }
  
  showPrivacy() {
    // Open privacy policy in new tab
    chrome.tabs.create({ 
      url: 'https://your-site.com/privacy' 
    });
  }
  
  showUpgrade() {
    // Show upgrade modal or open pricing page
    alert('🚀 Premium features coming soon!\n\n• Advanced insights\n• Competitor analysis\n• Automated reports\n• Priority support\n\nStay tuned!');
  }
  
  // Helper method to send messages to background script
  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
}

// Initialize the extension when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AIGrowthCoach();
});

// Handle window resize for charts
window.addEventListener('resize', () => {
  // Redraw charts if they exist
  setTimeout(() => {
    Object.values(window.aiGrowthCoach?.charts || {}).forEach(chart => {
      if (chart && typeof chart.resize === 'function') {
        chart.resize();
      }
    });
  }, 100);
});