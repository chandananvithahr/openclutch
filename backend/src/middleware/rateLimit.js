// Per-user sliding window rate limiter — listmonk manager pattern
// Prevents cost explosion from rogue users hammering the AI

'use strict';

const config  = require('../lib/config');
const windows = new Map(); // key -> { count, windowStart }

const { WINDOW_MS, MAX_REQUESTS, CLEANUP_INTERVAL } = config.RATE_LIMIT;

function rateLimitMiddleware(req, res, next) {
  // Primary: use JWT-authenticated userId (set by auth middleware)
  // Fallback: IP address (for unauthenticated or pre-auth requests)
  const userId = req.userId
    || req.ip
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || 'anonymous';

  const now = Date.now();

  let window = windows.get(userId);

  if (!window || now - window.windowStart > WINDOW_MS) {
    window = { count: 1, windowStart: now };
    windows.set(userId, window);
    return next();
  }

  window.count++;
  if (window.count > MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before trying again.',
    });
  }

  next();
}

// Cleanup stale windows (interval from config)
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of windows) {
    if (now - w.windowStart > WINDOW_MS * 2) windows.delete(key);
  }
}, CLEANUP_INTERVAL);

module.exports = { rateLimitMiddleware };
