'use strict';

// Per-user sliding window rate limiter — Supabase-backed for multi-instance Railway
// Falls back to in-memory if Supabase is unavailable (graceful degradation).
//
// Strategy: in-memory primary (fast), Supabase sync (persistent across deploys).
// On each request: check in-memory first → if new window, check Supabase for existing count.
// This avoids a DB call on every single request while surviving restarts.

const config   = require('../lib/config');
const supabase = require('../lib/supabase');
const logger   = require('../lib/logger');

const { WINDOW_MS, MAX_REQUESTS, CLEANUP_INTERVAL } = config.RATE_LIMIT;

// In-memory cache (fast path)
const windows = new Map(); // key -> { count, windowStart, synced }

// ─── Supabase rate limit table helpers ──────────────────────────────────────

let supabaseAvailable = true; // skip DB calls if table doesn't exist

async function getRemoteWindow(userId) {
  if (!supabaseAvailable) return null;
  try {
    const { data, error } = await supabase
      .from('rate_limits')
      .select('request_count, window_start')
      .eq('user_id', userId)
      .single();
    if (error && error.code === 'PGRST116') return null; // no row
    if (error) {
      // Table might not exist yet — disable Supabase path
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        supabaseAvailable = false;
        logger.warn('rate_limits table not found — using in-memory only');
      }
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

async function upsertRemoteWindow(userId, count, windowStart) {
  if (!supabaseAvailable) return;
  try {
    await supabase
      .from('rate_limits')
      .upsert({
        user_id: userId,
        request_count: count,
        window_start: new Date(windowStart).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
  } catch {
    // Non-blocking — if DB write fails, in-memory still works
  }
}

// ─── Middleware ──────────────────────────────────────────────────────────────

async function rateLimitMiddleware(req, res, next) {
  const userId = req.userId
    || req.ip
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || 'anonymous';

  const now = Date.now();
  let window = windows.get(userId);

  // Window expired or first request — check Supabase for surviving state
  if (!window || now - window.windowStart > WINDOW_MS) {
    const remote = await getRemoteWindow(userId);

    if (remote && now - new Date(remote.window_start).getTime() <= WINDOW_MS) {
      // Resume from Supabase (surviving a deploy restart)
      window = {
        count: remote.request_count + 1,
        windowStart: new Date(remote.window_start).getTime(),
        synced: false,
      };
    } else {
      window = { count: 1, windowStart: now, synced: false };
    }

    windows.set(userId, window);

    // Fire-and-forget sync to Supabase
    upsertRemoteWindow(userId, window.count, window.windowStart);
    return next();
  }

  window.count++;

  if (window.count > MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before trying again.',
    });
  }

  // Sync to Supabase every 5th request (batch, not every request)
  if (window.count % 5 === 0) {
    upsertRemoteWindow(userId, window.count, window.windowStart);
  }

  next();
}

// Cleanup stale in-memory windows
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of windows) {
    if (now - w.windowStart > WINDOW_MS * 2) windows.delete(key);
  }
}, CLEANUP_INTERVAL);

module.exports = { rateLimitMiddleware };
