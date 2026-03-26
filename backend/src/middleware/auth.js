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
// Only callbacks are public — browser redirects from OAuth providers carry no JWT.
// Login routes require auth so userId can be embedded in OAuth state.
const PUBLIC_PATHS = new Set([
  '/api/zerodha/callback',
  '/api/upstox/callback',
  '/api/fyers/callback',
  '/api/gmail/callback',
  '/api/calendar/callback',
  '/api/drive/callback',
  '/api/auth/token',    // legacy bootstrap (admin/dev only)
  '/api/auth/signup',   // self-service signup
  '/api/auth/login',    // self-service login
  '/health',
]);

function authMiddleware(req, res, next) {
  // Skip auth for public paths
  if (PUBLIC_PATHS.has(req.path)) return next();

  if (!JWT_SECRET) {
    // JWT_SECRET is required at startup (server.js REQUIRED_ENV check) — this should never happen.
    // If it does, reject the request rather than allowing unauthenticated access.
    return res.status(500).json({ error: 'Server misconfigured — auth unavailable.' });
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
