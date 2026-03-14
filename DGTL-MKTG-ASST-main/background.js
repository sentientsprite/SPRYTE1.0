// Service Worker for AI Growth Coach Extension
// Handles OAuth, API calls, and data analysis

let authToken = null;

// Promise wrappers for chrome.storage in service worker
function storageGet(keys) {
  return new Promise(resolve => chrome.storage.sync.get(keys, resolve));
}

function storageSet(obj) {
  return new Promise(resolve => chrome.storage.sync.set(obj, resolve));
}

// Mock data for development/fallback
const mockData = {
  sessions: [120, 135, 98, 156, 142, 118, 167, 134, 129, 145, 112, 156, 139, 147, 123, 165, 141, 128, 174, 138, 152, 119, 163, 145, 131, 159, 126, 168, 142, 137],
  users: [95, 108, 76, 124, 113, 94, 133, 107, 103, 115, 89, 124, 111, 117, 98, 131, 112, 102, 138, 110, 121, 95, 129, 115, 104, 126, 100, 133, 113, 109],
  bounceRate: [45.2, 42.1, 58.3, 38.7, 41.2, 46.8, 35.9, 43.5, 44.7, 40.3, 52.1, 37.8, 42.9, 39.6, 47.3, 36.4, 41.7, 45.9, 34.2, 43.1, 38.8, 48.6, 36.7, 40.9, 44.2, 37.5, 46.1, 35.3, 41.4, 42.8],
  sources: {
    organic: 42,
    paid: 28,
    direct: 18,
    social: 8,
    referral: 4
  },
  conversionRate: 2.8,
  avgSessionDuration: 145 // seconds
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAnalytics') {
    handleAnalyticsRequest(request.propertyId)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'authenticate') {
    // If a clientId is provided from the popup settings, store it for debugging
    if (request.clientId) {
      storageSet({ oauthClientId: request.clientId });
    }

    authenticateUser(request.clientId)
      .then(token => sendResponse({ success: true, token }))
      .catch(error => {
        // Provide an actionable message for common OAuth errors
        let message = error.message || 'Authentication failed.';
        if (/bad client id/i.test(message) || /invalid client id/i.test(message)) {
          message = 'OAuth error: bad client id. Ensure your OAuth Client ID is correct in settings and in the Google Cloud Console, and that you registered the extension/app correctly.';
        }
        sendResponse({ success: false, error: message });
      });
    return true;
  }
  
  if (request.action === 'askQuestion') {
    const answer = processQuestion(request.question, request.data);
    sendResponse({ success: true, answer });
  }
});

// OAuth Authentication
async function authenticateUser(clientId) {
  try {
    // If the popup provided a clientId, attempt a web auth flow that requests
    // an access token directly (implicit flow). Note: using implicit flow
    // requires that the client be configured to allow the extension's redirect
    // URI. The redirect URI for Chrome extensions is of the form:
    // https://<extension_id>.chromiumapp.org/
    if (clientId) {
      // store client id
      await storageSet({ oauthClientId: clientId });

      const redirectUri = chrome.identity.getRedirectURL();
      const scopes = encodeURIComponent('https://www.googleapis.com/auth/analytics.readonly');
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&prompt=consent`;

      try {
        const resultUrl = await new Promise((resolve, reject) => {
          chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectedTo) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!redirectedTo) return reject(new Error('No redirect URL returned'));
            resolve(redirectedTo);
          });
        });

        // resultUrl will contain the access token as a hash fragment
        const hash = resultUrl.split('#')[1] || '';
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const expiresIn = params.get('expires_in');

        if (!accessToken) throw new Error('No access token returned from OAuth flow');

        authToken = accessToken;
        await storageSet({ authToken: accessToken, authTokenExpiry: expiresIn ? Date.now() + parseInt(expiresIn, 10) * 1000 : null });
        return accessToken;
      } catch (err) {
        console.error('launchWebAuthFlow failed:', err);
        throw err;
      }
    }

    // Fallback to the chrome.identity built-in flow which uses the client id
    // configured in the extension manifest.
    const details = { interactive: true };
    const token = await chrome.identity.getAuthToken(details);
    authToken = token;
    await storageSet({ authToken: token });
    return token;
  } catch (error) {
    console.error('Authentication failed:', error);
    // Bubble up the raw error message so the popup can show a helpful note
    throw new Error(error && error.message ? error.message : 'Failed to authenticate. Please try again.');
  }
}

// Main analytics data handler
async function handleAnalyticsRequest(propertyId) {
  try {
    // Check if we have a stored token
    if (!authToken) {
      const stored = await storageGet(['authToken']);
      authToken = stored.authToken;
    }
    
    if (!authToken) {
      throw new Error('No authentication token. Please authenticate first.');
    }
    
    // Try to fetch real data, fallback to mock
    let analyticsData;
    try {
      analyticsData = await fetchGoogleAnalyticsData(propertyId);
    } catch (error) {
      console.warn('GA API failed, using mock data:', error);
      analyticsData = mockData;
    }
    
    // Analyze the data with our "AI" rules
    const insights = analyzeDataWithAI(analyticsData);
    
    return {
      raw: analyticsData,
      insights: insights,
      timestamp: Date.now()
    };
    
  } catch (error) {
    console.error('Analytics request failed:', error);
    // Always fallback to mock data for MVP
    return {
      raw: mockData,
      insights: analyzeDataWithAI(mockData),
      timestamp: Date.now(),
      isMockData: true
    };
  }
}

// Fetch data from Google Analytics API
async function fetchGoogleAnalyticsData(propertyId) {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const requestBody = {
    reportRequests: [{
      viewId: propertyId,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { expression: 'ga:sessions' },
        { expression: 'ga:users' },
        { expression: 'ga:bounceRate' },
        { expression: 'ga:avgSessionDuration' }
      ],
      dimensions: [
        { name: 'ga:date' },
        { name: 'ga:channelGrouping' }
      ]
    }]
  };
  
  const response = await fetch('https://analyticsreporting.googleapis.com/v4/reports:batchGet', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    throw new Error(`GA API error: ${response.status}`);
  }
  
  const data = await response.json();
  return parseGAResponse(data);
}

// Parse GA API response into our format
function parseGAResponse(gaData) {
  const report = gaData.reports[0];
  const sessions = [];
  const users = [];
  const bounceRate = [];
  const sources = {};
  
  if (report.data && report.data.rows) {
    report.data.rows.forEach(row => {
      sessions.push(parseInt(row.metrics[0].values[0]));
      users.push(parseInt(row.metrics[0].values[1]));
      bounceRate.push(parseFloat(row.metrics[0].values[2]));
      
      const source = row.dimensions[1];
      sources[source] = (sources[source] || 0) + parseInt(row.metrics[0].values[0]);
    });
  }
  
  return {
    sessions,
    users,
    bounceRate,
    sources,
    avgSessionDuration: 150 // Placeholder
  };
}

// Rule-based AI analysis engine
function analyzeDataWithAI(data) {
  const insights = [];
  
  // Calculate trends
  const recentSessions = (data.sessions || []).slice(-7);
  const previousSessions = (data.sessions || []).slice(-14, -7);
  const recentAvg = recentSessions.length ? average(recentSessions) : 0;
  const previousAvg = previousSessions.length ? average(previousSessions) : recentAvg || 1;
  const sessionTrend = calculatePercentChange(recentAvg, previousAvg);
  
  const avgBounceRate = (data.bounceRate && data.bounceRate.length) ? average(data.bounceRate) : 0;
  const recentBounceRate = (data.bounceRate && data.bounceRate.slice(-7).length) ? average(data.bounceRate.slice(-7)) : avgBounceRate;
  const bounceRateTrend = calculatePercentChange(recentBounceRate, avgBounceRate);
  
  // Rule 1: Session trend analysis
  if (sessionTrend < -15) {
    insights.push({
      type: 'warning',
      title: '🚨 Traffic Drop Alert',
      message: `Hey! Your sessions dropped ${Math.abs(sessionTrend).toFixed(1)}% this week. This could be due to seasonal changes or SEO issues.`,
      action: 'Consider boosting your content with long-tail keywords or checking for broken links.'
    });
  } else if (sessionTrend > 20) {
    insights.push({
      type: 'success',
      title: '🎉 Traffic Surge',
      message: `Awesome! Your traffic jumped ${sessionTrend.toFixed(1)}% this week. Something's working!`,
      action: 'Double down on what you did recently - more content like this, or increase ad spend.'
    });
  }
  
  // Rule 2: Bounce rate analysis
  if (avgBounceRate > 60) {
    insights.push({
      type: 'warning',
      title: '⚠️ High Bounce Rate',
      message: `Your bounce rate is ${avgBounceRate.toFixed(1)}% - visitors are leaving quickly.`,
      action: 'Improve page load speed, make your value proposition clearer, or simplify navigation.'
    });
  }
  
  // Rule 3: Traffic source analysis
  const totalTraffic = Object.values(data.sources).reduce((a, b) => a + b, 0);
  const paidPercent = totalTraffic ? (data.sources.paid || 0) / totalTraffic * 100 : 0;
  
  if (paidPercent > 50 && avgBounceRate > 55) {
    insights.push({
      type: 'warning',
      title: '💸 Ad Waste Alert',
      message: `Over ${paidPercent.toFixed(0)}% of your traffic is paid, but bounce rate is high.`,
      action: 'Refine your ad targeting or improve landing page relevance to reduce waste.'
    });
  }
  
  // Rule 4: Organic traffic opportunity
  const organicPercent = totalTraffic ? (data.sources.organic || 0) / totalTraffic * 100 : 0;
  if (organicPercent < 30) {
    insights.push({
      type: 'opportunity',
      title: '🌱 SEO Opportunity',
      message: `Only ${organicPercent.toFixed(0)}% of your traffic is organic - huge growth potential!`,
      action: 'Focus on content marketing, keyword research, and building quality backlinks.'
    });
  }
  
  // Rule 5: Engagement insights
  if (data.avgSessionDuration < 60) {
    insights.push({
      type: 'warning',
      title: '⏰ Short Session Alert',
      message: 'Visitors spend less than a minute on your site on average.',
      action: 'Add engaging content above the fold, improve page design, or add internal links.'
    });
  }
  
  // Always add at least one positive insight if none exist
  if (insights.filter(i => i.type === 'success').length === 0) {
    insights.push({
      type: 'success',
      title: '✅ You\'re Tracking!',
      message: 'Great job monitoring your analytics. Consistent tracking is the first step to growth.',
      action: 'Keep checking these insights weekly and act on the recommendations above.'
    });
  }
  
  return insights.slice(0, 5); // Limit to 5 insights max
}

// Question processing for "Ask Me" feature
function processQuestion(question, data) {
  const lowerQ = question.toLowerCase();
  
  if (lowerQ.includes('traffic') || lowerQ.includes('session')) {
  const recentArr = (data.raw.sessions || []).slice(-7);
  const prevArr = (data.raw.sessions || []).slice(-14, -7);
  const recent = recentArr.length ? average(recentArr) : 0;
  const previous = prevArr.length ? average(prevArr) : recent || 1;
  const change = calculatePercentChange(recent, previous);
    
    return `Based on your data, you're averaging ${recent.toFixed(0)} sessions per day this week, which is ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}% from last week. ${change < -10 ? 'Consider boosting your content promotion or checking for technical issues.' : change > 10 ? 'Great momentum! Keep doing what you\'re doing.' : 'Steady traffic - focus on conversion optimization.'}`;
  }
  
  if (lowerQ.includes('bounce') || lowerQ.includes('leaving')) {
  const bounceRate = (data.raw.bounceRate && data.raw.bounceRate.length) ? average(data.raw.bounceRate) : 0;
    return `Your average bounce rate is ${bounceRate.toFixed(1)}%. ${bounceRate > 60 ? 'This is on the higher side - visitors might not be finding what they expect. Try improving your headlines and page load speed.' : bounceRate < 40 ? 'Excellent! Your content is engaging visitors well.' : 'This is in a decent range, but there\'s room for improvement with better content and UX.'}`;
  }
  
  if (lowerQ.includes('source') || lowerQ.includes('where') || lowerQ.includes('coming')) {
    const sources = data.raw.sources;
    const total = Object.values(sources).reduce((a, b) => a + b, 0);
    const topSource = Object.keys(sources).reduce((a, b) => sources[a] > sources[b] ? a : b);
    const topPercent = (sources[topSource] / total * 100).toFixed(0);
    
    return `Your top traffic source is ${topSource} at ${topPercent}% of total visits. ${topSource === 'organic' ? 'Great SEO work!' : topSource === 'paid' ? 'Make sure your ad spend is profitable.' : topSource === 'direct' ? 'Strong brand recognition!' : 'Diversify your traffic sources for stability.'} Consider investing more in sources that convert well.`;
  }
  
  if (lowerQ.includes('improve') || lowerQ.includes('grow') || lowerQ.includes('help')) {
    const insights = data.insights.filter(i => i.type === 'warning' || i.type === 'opportunity');
    if (insights.length > 0) {
      const topIssue = insights[0];
      return `Here's your biggest opportunity: ${topIssue.message} ${topIssue.action} Focus on this first for maximum impact.`;
    }
    return 'Your analytics look healthy overall! Focus on consistent content creation and user experience improvements for steady growth.';
  }
  
  // Default response
  return `I analyzed your question about "${question}" but need more specific keywords. Try asking about 'traffic trends', 'bounce rate', 'traffic sources', or 'how to improve'. I'm here to help you understand your data better!`;
}

// Utility functions
function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculatePercentChange(current, previous) {
  return ((current - previous) / previous) * 100;
}

// Set up periodic data refresh (optional)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshData') {
    // Could trigger background data refresh here
    console.log('Scheduled data refresh triggered');
  }
});

// Install handler
chrome.runtime.onInstalled.addListener(() => {
  // Set up periodic refresh (daily)
  chrome.alarms.create('refreshData', { periodInMinutes: 1440 });
});