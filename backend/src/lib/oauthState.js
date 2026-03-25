'use strict';

// CSRF protection for OAuth flows — short-lived in-memory state tokens
// Pattern: generate state on /login, verify state on /callback, delete after use

const crypto = require('crypto');

// Map of state → { createdAt, userId }
const pendingStates = new Map();

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — more than enough for a login

function generateState(userId) {
  const state = crypto.randomBytes(24).toString('hex');
  pendingStates.set(state, { createdAt: Date.now(), userId: userId || null });
  return state;
}

function validateState(state) {
  if (!state) return { valid: false, userId: null };
  const entry = pendingStates.get(state);
  if (!entry) return { valid: false, userId: null };
  pendingStates.delete(state); // single-use
  if (Date.now() - entry.createdAt > STATE_TTL_MS) return { valid: false, userId: null };
  return { valid: true, userId: entry.userId };
}

// Prune expired states every 15 minutes
setInterval(() => {
  const cutoff = Date.now() - STATE_TTL_MS;
  for (const [key, val] of pendingStates) {
    if (val.createdAt < cutoff) pendingStates.delete(key);
  }
}, 15 * 60 * 1000);

module.exports = { generateState, validateState };
