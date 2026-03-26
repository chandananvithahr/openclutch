'use strict';

// POST /api/auth/token — issue a JWT for a given userId
// SECURITY: Requires AUTH_BOOTSTRAP_SECRET to prevent unauthorized token issuance.
// In production this will be replaced by Supabase Auth / OTP verification.
//
// Body: { userId: string, secret: string }
// Returns: { token: string, expiresIn: "30d" }

const express = require('express');
const router  = express.Router();
const { issueToken } = require('../middleware/auth');
const logger  = require('../lib/logger');

const BOOTSTRAP_SECRET = process.env.AUTH_BOOTSTRAP_SECRET;
const MAX_ATTEMPTS_PER_IP = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const ipAttempts = new Map();

// IP-based brute force protection
function checkIPLimit(ip) {
  const now = Date.now();
  const entry = ipAttempts.get(ip);
  if (!entry || now - entry.windowStart > ATTEMPT_WINDOW_MS) {
    ipAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS_PER_IP;
}

// Cleanup stale IP entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipAttempts) {
    if (now - entry.windowStart > ATTEMPT_WINDOW_MS * 2) ipAttempts.delete(ip);
  }
}, 30 * 60 * 1000);

router.post('/token', (req, res) => {
  const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  if (!checkIPLimit(clientIP)) {
    logger.warn('Auth rate limit exceeded', { ip: clientIP });
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const { userId, secret } = req.body;

  // Require bootstrap secret — prevents anyone from minting tokens
  if (!BOOTSTRAP_SECRET) {
    return res.status(503).json({ error: 'Auth not configured. Set AUTH_BOOTSTRAP_SECRET env var.' });
  }

  if (!secret || secret !== BOOTSTRAP_SECRET) {
    logger.warn('Auth failed — invalid secret', { ip: clientIP });
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (userId.trim().length > 128) {
    return res.status(400).json({ error: 'userId too long' });
  }

  try {
    const token = issueToken(userId.trim());
    logger.info('Token issued', { userId: userId.trim().slice(0, 8) + '...' });
    res.json({ token, expiresIn: '30d' });
  } catch (err) {
    logger.error('Token issuance failed', { err: err.message });
    res.status(500).json({ error: 'Could not issue token.' });
  }
});

module.exports = router;
