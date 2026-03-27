'use strict';

// CSRF protection for OAuth flows — Supabase-backed state tokens
// Survives server restarts and Railway redeploys.
// Pattern: generate state on /login, verify state on /callback, delete after use

const crypto = require('crypto');
const supabase = require('./supabase');
const { supabaseAdmin } = require('./supabase');
const logger = require('./logger');

const STATE_TTL_MS = 30 * 60 * 1000; // 30 minutes — users may take time on broker login pages

// Use service_role client if available, fall back to anon
const db = supabaseAdmin || supabase;

async function generateState(userId) {
  const state = crypto.randomBytes(24).toString('hex');

  const { error } = await db
    .from('oauth_states')
    .insert({ state, user_id: userId || null });

  if (error) {
    logger.error('Failed to save OAuth state', { error: error.message });
  }

  return state;
}

async function validateState(state) {
  if (!state) {
    logger.warn('OAuth validateState: no state param received');
    return { valid: false, userId: null };
  }

  logger.info('OAuth validateState: looking up state', { state: state.slice(0, 10) + '...' });

  const { data, error } = await db
    .from('oauth_states')
    .select('user_id, created_at')
    .eq('state', state)
    .single();

  if (error || !data) {
    logger.error('OAuth validateState: state not found in DB', {
      state: state.slice(0, 10) + '...',
      error: error?.message || 'no data',
    });
    return { valid: false, userId: null };
  }

  // Delete after reading (single-use)
  await db.from('oauth_states').delete().eq('state', state);

  // Check expiry
  const age = Date.now() - new Date(data.created_at).getTime();
  if (age > STATE_TTL_MS) {
    logger.warn('OAuth validateState: state expired', { age_ms: age });
    return { valid: false, userId: null };
  }

  logger.info('OAuth validateState: success', { userId: data.user_id });
  return { valid: true, userId: data.user_id };
}

// Cleanup expired states every 15 minutes
setInterval(async () => {
  const cutoff = new Date(Date.now() - STATE_TTL_MS).toISOString();
  const { error } = await db
    .from('oauth_states')
    .delete()
    .lt('created_at', cutoff);
  if (error) logger.error('OAuth state cleanup failed', { error: error.message });
}, 15 * 60 * 1000);

module.exports = { generateState, validateState };
