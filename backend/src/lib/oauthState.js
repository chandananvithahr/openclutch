'use strict';

// CSRF protection for OAuth flows — Supabase-backed state tokens
// Survives server restarts and Railway redeploys.
// Pattern: generate state on /login, verify state on /callback, delete after use

const crypto = require('crypto');
const { supabaseAdmin } = require('./supabase');
const logger = require('./logger');

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateState(userId) {
  const state = crypto.randomBytes(24).toString('hex');

  // Fire-and-forget insert — don't block the login redirect
  supabaseAdmin
    .from('oauth_states')
    .insert({ state, user_id: userId || null })
    .then(({ error }) => {
      if (error) logger.error('Failed to save OAuth state', { error: error.message });
    });

  return state;
}

async function validateState(state) {
  if (!state) return { valid: false, userId: null };

  // Fetch and delete in one step (select then delete)
  const { data, error } = await supabaseAdmin
    .from('oauth_states')
    .select('user_id, created_at')
    .eq('state', state)
    .single();

  if (error || !data) return { valid: false, userId: null };

  // Delete after reading (single-use)
  await supabaseAdmin.from('oauth_states').delete().eq('state', state);

  // Check expiry
  const age = Date.now() - new Date(data.created_at).getTime();
  if (age > STATE_TTL_MS) return { valid: false, userId: null };

  return { valid: true, userId: data.user_id };
}

// Cleanup expired states every 15 minutes
setInterval(async () => {
  const cutoff = new Date(Date.now() - STATE_TTL_MS).toISOString();
  const { error } = await supabaseAdmin
    .from('oauth_states')
    .delete()
    .lt('created_at', cutoff);
  if (error) logger.error('OAuth state cleanup failed', { error: error.message });
}, 15 * 60 * 1000);

module.exports = { generateState, validateState };
