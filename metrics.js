/**
 * Metrics System - Personal Trainer
 * Integrates Instagram Graph API + Beehiiv API
 *
 * Environment variables:
 *   INSTAGRAM_ACCESS_TOKEN   - Instagram Graph API token
 *   INSTAGRAM_USER_ID        - Instagram Business Account ID
 *   BEEHIIV_API_KEY          - Beehiiv API key
 *   BEEHIIV_PUBLICATION_ID   - Beehiiv publication ID
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Config
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_USER_ID = process.env.INSTAGRAM_USER_ID;
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;

const METRICS_FILE = process.env.METRICS_FILE || './data/metrics-history.json';

// ============================================
// Instagram Graph API
// ============================================

async function getInstagramMetrics() {
  if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_USER_ID) {
    console.log('⚠️ Instagram credentials not configured, using mock data');
    return getMockInstagramMetrics();
  }

  try {
    // Get basic account info
    const accountUrl = `https://graph.facebook.com/v18.0/${INSTAGRAM_USER_ID}?fields=followers_count,media_count,username&access_token=${INSTAGRAM_ACCESS_TOKEN}`;
    const account = await fetchJSON(accountUrl);

    // Get insights (last 30 days)
    const insightsUrl = `https://graph.facebook.com/v18.0/${INSTAGRAM_USER_ID}/insights?metric=reach,impressions,profile_views&period=day&access_token=${INSTAGRAM_ACCESS_TOKEN}`;
    const insights = await fetchJSON(insightsUrl);

    // Get recent media for engagement calculation
    const mediaUrl = `https://graph.facebook.com/v18.0/${INSTAGRAM_USER_ID}/media?fields=like_count,comments_count,timestamp&limit=10&access_token=${INSTAGRAM_ACCESS_TOKEN}`;
    const media = await fetchJSON(mediaUrl);

    // Calculate engagement rate
    let totalEngagement = 0;
    let postCount = 0;
    if (media.data) {
      media.data.forEach(post => {
        totalEngagement += (post.like_count || 0) + (post.comments_count || 0);
        postCount++;
      });
    }
    const avgEngagement = postCount > 0 ? totalEngagement / postCount : 0;
    const engagementRate = account.followers_count > 0
      ? ((avgEngagement / account.followers_count) * 100).toFixed(2)
      : 0;

    return {
      followers: account.followers_count || 0,
      media_count: account.media_count || 0,
      engagement_rate: parseFloat(engagementRate),
      avg_likes: postCount > 0 ? Math.round(totalEngagement / postCount * 0.8) : 0,
      avg_comments: postCount > 0 ? Math.round(totalEngagement / postCount * 0.2) : 0,
      reach_today: insights.data?.[0]?.values?.[0]?.value || 0,
      source: 'api',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Instagram API error:', error.message);
    return getMockInstagramMetrics();
  }
}

function getMockInstagramMetrics() {
  // Load last known metrics or use defaults
  const history = loadMetricsHistory();
  const lastIG = history.instagram?.[history.instagram.length - 1];

  return {
    followers: lastIG?.followers || 2400,
    media_count: lastIG?.media_count || 45,
    engagement_rate: lastIG?.engagement_rate || 1.19,
    avg_likes: lastIG?.avg_likes || 25,
    avg_comments: lastIG?.avg_comments || 5,
    reach_today: lastIG?.reach_today || 267,
    source: 'cache',
    timestamp: new Date().toISOString()
  };
}

// ============================================
// Beehiiv API
// ============================================

async function getBeehiivMetrics() {
  if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
    console.log('⚠️ Beehiiv credentials not configured, using mock data');
    return getMockBeehiivMetrics();
  }

  try {
    // Get publication stats
    const pubUrl = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}?expand[]=stats`;

    const publication = await new Promise((resolve, reject) => {
      const req = https.request(pubUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
          'Accept': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    const stats = publication.data?.stats || {};

    return {
      subscribers: stats.total_subscriptions || stats.active_subscriptions || 0,
      active_subscribers: stats.active_subscriptions || 0,
      // Beehiiv returns rates already as percentages (e.g., 40.09 not 0.4009)
      open_rate: stats.average_open_rate ? stats.average_open_rate.toFixed(1) : 0,
      click_rate: stats.average_click_rate ? stats.average_click_rate.toFixed(1) : 0,
      source: 'api',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Beehiiv API error:', error.message);
    return getMockBeehiivMetrics();
  }
}

function getMockBeehiivMetrics() {
  const history = loadMetricsHistory();
  const lastBee = history.beehiiv?.[history.beehiiv.length - 1];

  return {
    subscribers: lastBee?.subscribers || 74,
    active_subscribers: lastBee?.active_subscribers || 74,
    open_rate: lastBee?.open_rate || 34,
    click_rate: lastBee?.click_rate || 6.38,
    source: 'cache',
    timestamp: new Date().toISOString()
  };
}

// ============================================
// Metrics History & Comparison
// ============================================

function loadMetricsHistory() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
    }
  } catch (e) {}

  return {
    instagram: [],
    beehiiv: [],
    lastUpdated: null
  };
}

function saveMetricsHistory(instagram, beehiiv) {
  const history = loadMetricsHistory();
  const today = new Date().toISOString().split('T')[0];

  // Add today's metrics (avoid duplicates)
  const lastIGDate = history.instagram[history.instagram.length - 1]?.date;
  if (lastIGDate !== today) {
    history.instagram.push({ ...instagram, date: today });
  } else {
    history.instagram[history.instagram.length - 1] = { ...instagram, date: today };
  }

  const lastBeeDate = history.beehiiv[history.beehiiv.length - 1]?.date;
  if (lastBeeDate !== today) {
    history.beehiiv.push({ ...beehiiv, date: today });
  } else {
    history.beehiiv[history.beehiiv.length - 1] = { ...beehiiv, date: today };
  }

  // Keep only last 90 days
  history.instagram = history.instagram.slice(-90);
  history.beehiiv = history.beehiiv.slice(-90);
  history.lastUpdated = new Date().toISOString();

  const dir = path.dirname(METRICS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(METRICS_FILE, JSON.stringify(history, null, 2));
}

function getYesterdayComparison(currentIG, currentBee) {
  const history = loadMetricsHistory();

  const yesterdayIG = history.instagram[history.instagram.length - 2] || history.instagram[history.instagram.length - 1];
  const yesterdayBee = history.beehiiv[history.beehiiv.length - 2] || history.beehiiv[history.beehiiv.length - 1];

  const followersDiff = currentIG.followers - (yesterdayIG?.followers || currentIG.followers);
  const subscribersDiff = currentBee.subscribers - (yesterdayBee?.subscribers || currentBee.subscribers);
  const engagementDiff = (currentIG.engagement_rate - (yesterdayIG?.engagement_rate || currentIG.engagement_rate)).toFixed(2);

  return {
    followers: {
      diff: followersDiff,
      symbol: followersDiff >= 0 ? '+' : '',
      trend: followersDiff > 0 ? '📈' : followersDiff < 0 ? '📉' : '➡️'
    },
    subscribers: {
      diff: subscribersDiff,
      symbol: subscribersDiff >= 0 ? '+' : '',
      trend: subscribersDiff > 0 ? '📈' : subscribersDiff < 0 ? '📉' : '➡️'
    },
    engagement: {
      diff: parseFloat(engagementDiff),
      symbol: parseFloat(engagementDiff) >= 0 ? '+' : '',
      trend: parseFloat(engagementDiff) > 0 ? '📈' : parseFloat(engagementDiff) < 0 ? '📉' : '➡️'
    }
  };
}

// ============================================
// Benchmarks & Goals
// ============================================

const BENCHMARKS = {
  followers: {
    current_goal: 3500,    // 90 dias
    stretch_goal: 10000,   // 12 meses
    label: 'Seguidores'
  },
  engagement: {
    current_goal: 3.0,
    stretch_goal: 6.0,
    label: 'Engajamento'
  },
  subscribers: {
    current_goal: 500,     // 12 semanas
    stretch_goal: 2000,
    label: 'Newsletter'
  },
  open_rate: {
    current_goal: 40,
    stretch_goal: 50,
    label: 'Open Rate'
  }
};

function calculateProgress(current, goal) {
  const pct = Math.min(100, (current / goal) * 100).toFixed(0);
  const bar = generateProgressBar(parseInt(pct));
  return { pct, bar };
}

function generateProgressBar(pct, length = 10) {
  const filled = Math.round((pct / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// ============================================
// Combined Metrics Fetch
// ============================================

async function getAllMetrics() {
  const [instagram, beehiiv] = await Promise.all([
    getInstagramMetrics(),
    getBeehiivMetrics()
  ]);

  // Save to history
  saveMetricsHistory(instagram, beehiiv);

  // Get comparison
  const comparison = getYesterdayComparison(instagram, beehiiv);

  // Calculate progress
  const progress = {
    followers: calculateProgress(instagram.followers, BENCHMARKS.followers.current_goal),
    engagement: calculateProgress(instagram.engagement_rate, BENCHMARKS.engagement.current_goal),
    subscribers: calculateProgress(beehiiv.subscribers, BENCHMARKS.subscribers.current_goal),
    open_rate: calculateProgress(parseFloat(beehiiv.open_rate), BENCHMARKS.open_rate.current_goal)
  };

  return {
    instagram,
    beehiiv,
    comparison,
    progress,
    benchmarks: BENCHMARKS,
    fetchedAt: new Date().toISOString()
  };
}

// ============================================
// Helper
// ============================================

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// ============================================
// Manual Update (for testing)
// ============================================

function manualUpdateMetrics(igFollowers, beeSubscribers) {
  const history = loadMetricsHistory();
  const today = new Date().toISOString().split('T')[0];

  // Update Instagram
  if (igFollowers) {
    const lastIG = history.instagram[history.instagram.length - 1] || {};
    history.instagram.push({
      ...lastIG,
      followers: igFollowers,
      date: today,
      source: 'manual'
    });
  }

  // Update Beehiiv
  if (beeSubscribers) {
    const lastBee = history.beehiiv[history.beehiiv.length - 1] || {};
    history.beehiiv.push({
      ...lastBee,
      subscribers: beeSubscribers,
      date: today,
      source: 'manual'
    });
  }

  history.lastUpdated = new Date().toISOString();

  const dir = path.dirname(METRICS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(METRICS_FILE, JSON.stringify(history, null, 2));
  console.log('✅ Metrics updated manually');
}

module.exports = {
  getInstagramMetrics,
  getBeehiivMetrics,
  getAllMetrics,
  getYesterdayComparison,
  calculateProgress,
  generateProgressBar,
  manualUpdateMetrics,
  BENCHMARKS
};
