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

module.exports = {
  markCheckinDone,
  markMissionDone,
  markPosted,
  loadState,
  saveState
};
