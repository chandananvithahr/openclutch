'use strict';

// JWT auth middleware — verifies Bearer token on all /api/* routes
// Issues tokens via POST /api/auth/token (dev/testing) until proper mobile auth is wired
//
// Mobile sends: Authorization: Bearer <jwt>
// Middleware verifies, extracts userId, sets req.userId for all downstream handlers.
// Routes read req.userId instead of trusting req.body.userId or req.query.userId.

const jwt    = require('jsonwebtoken');
const logger = require('../lib/logger');

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = '30d'; // long-lived for mobile — user shouldn't re-login constantly

// Routes that don't require auth (OAuth callbacks must be open — browser redirects have no token)
const PUBLIC_PATHS = new Set([
  '/api/zerodha/login',
  '/api/zerodha/callback',
  '/api/upstox/login',
  '/api/upstox/callback',
  '/api/fyers/login',
  '/api/fyers/callback',
  '/api/gmail/login',
  '/api/gmail/callback',
  '/api/calendar/login',
  '/api/calendar/callback',
  '/api/drive/login',
  '/api/drive/callback',
  '/api/auth/token',   // token issuance endpoint
  '/health',
]);

function authMiddleware(req, res, next) {
  // Skip auth for public paths
  if (PUBLIC_PATHS.has(req.path)) return next();

  if (!JWT_SECRET) {
    // JWT_SECRET not set — warn but allow through (dev fallback, never in prod)
    logger.warn('JWT_SECRET not set — auth disabled. Set JWT_SECRET env var.');
    req.userId = req.body?.userId || req.query?.userId || 'dev_user';
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    logger.warn('JWT verification failed', { err: err.message, path: req.path });
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

function issueToken(userId) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

module.exports = { authMiddleware, issueToken };
