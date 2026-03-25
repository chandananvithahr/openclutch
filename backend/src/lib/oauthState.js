'use strict';

// CSRF protection for OAuth flows — short-lived in-memory state tokens
// Pattern: generate state on /login, verify state on /callback, delete after use

const crypto = require('crypto');

// Map of state → { createdAt }
const pendingStates = new Map();

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — more than enough for a login

function generateState() {
  const state = crypto.randomBytes(24).toString('hex');
  pendingStates.set(state, { createdAt: Date.now() });
  return state;
}

function validateState(state) {
  if (!state) return false;
  const entry = pendingStates.get(state);
  if (!entry) return false;
  pendingStates.delete(state); // single-use
  if (Date.now() - entry.createdAt > STATE_TTL_MS) return false;
  return true;
}

// Prune expired states every 15 minutes
setInterval(() => {
  const cutoff = Date.now() - STATE_TTL_MS;
  for (const [key, val] of pendingStates) {
    if (val.createdAt < cutoff) pendingStates.delete(key);
  }
}, 15 * 60 * 1000);

module.exports = { generateState, validateState };
