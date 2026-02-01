/**
 * Scheduler - Personal Trainer (Deploy Version)
 * State stored in memory (or use Redis/SQLite for persistence)
 */

const fs = require('fs');
const path = require('path');
const { sendWhatsApp, templates } = require('./whatsapp');

// State file (persistent on disk)
const STATE_FILE = process.env.STATE_FILE || './data/state.json';

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) { }

  return {
    last_checkin: null,
    last_post: null,
    last_message: null,
    messages_today: 0,
    checkin_done_today: false,
    mission_done_today: false,
    posted_today: false,
    streak_days: 0,
    // Newsletter states
    newsletter_started_today: false,
    newsletter_sent_today: false,
    newsletter_streak: 0,
    last_newsletter: null,
    date: new Date().toISOString().split('T')[0]
  };
}

function saveState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Reset diário
  const today = new Date().toISOString().split('T')[0];
  if (state.date !== today) {
    state.date = today;
    state.messages_today = 0;
    state.checkin_done_today = false;
    state.mission_done_today = false;
    state.posted_today = false;
    // Newsletter resets
    state.newsletter_started_today = false;
    state.newsletter_sent_today = false;
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function markCheckinDone() {
  const state = loadState();
  state.checkin_done_today = true;
  state.last_checkin = new Date().toISOString();
  saveState(state);
  console.log('Check-in marcado como feito');
}

function markMissionDone() {
  const state = loadState();
  state.mission_done_today = true;
  saveState(state);
  console.log('Missão marcada como feita');
}

function markPosted() {
  const state = loadState();

  // Check if already posted today to properly calculate streak
  if (!state.posted_today) {
    state.posted_today = true;

    // Calculate streak
    if (state.last_post) {
      const lastPost = new Date(state.last_post);
      const now = new Date();
      const daysSince = Math.floor((now - lastPost) / (1000 * 60 * 60 * 24));
      if (daysSince <= 1) {
        state.streak_days = (state.streak_days || 0) + 1;
      } else {
        state.streak_days = 1;
      }
    } else {
      state.streak_days = 1;
    }

    state.last_post = new Date().toISOString();
  }

  saveState(state);
  console.log(`Post registrado (streak: ${state.streak_days} dias)`);
}

function markNewsletterStarted() {
  const state = loadState();
  state.newsletter_started_today = true;
  saveState(state);
  console.log('Newsletter marcada como iniciada');
}

function markNewsletterSent() {
  const state = loadState();

  if (!state.newsletter_sent_today) {
    state.newsletter_sent_today = true;

    // Calculate newsletter streak
    if (state.last_newsletter) {
      const lastNews = new Date(state.last_newsletter);
      const now = new Date();
      const daysSince = Math.floor((now - lastNews) / (1000 * 60 * 60 * 24));
      // Newsletter is 2x per week (Tue/Fri), so 3-4 days is normal
      if (daysSince <= 4) {
        state.newsletter_streak = (state.newsletter_streak || 0) + 1;
      } else {
        state.newsletter_streak = 1;
      }
    } else {
      state.newsletter_streak = 1;
    }

    state.last_newsletter = new Date().toISOString();
  }

  saveState(state);
  console.log(`Newsletter enviada (streak: ${state.newsletter_streak} edições)`);
}

module.exports = {
  markCheckinDone,
  markMissionDone,
  markPosted,
  markNewsletterStarted,
  markNewsletterSent,
  loadState,
  saveState
};
