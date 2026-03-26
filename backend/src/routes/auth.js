'use strict';

// Auth routes — self-service signup/login for 1000-user launch
//
// POST /api/auth/signup  — create account (email + password + name) → JWT
// POST /api/auth/login   — authenticate → JWT
// POST /api/auth/token   — legacy bootstrap (admin only, kept for dev)
//
// Passwords are hashed with bcryptjs (10 rounds).
// User credentials stored in user_profiles table (email + password_hash columns).

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const { issueToken } = require('../middleware/auth');
const logger   = require('../lib/logger');
const { validate, signupSchema, loginSchema } = require('../lib/validation');
const supabase = require('../lib/supabase');

const BOOTSTRAP_SECRET = process.env.AUTH_BOOTSTRAP_SECRET;
const BCRYPT_ROUNDS = 10;
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

// ─── POST /signup ───────────────────────────────────────────────────────────

router.post('/signup', async (req, res) => {
  const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  if (!checkIPLimit(clientIP)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const { data: body, error: valError } = validate(signupSchema, req.body);
  if (valError) {
    return res.status(400).json({ error: valError });
  }

  try {
    // Check if email already exists
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('email', body.email)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    // Generate a stable user_id from email (deterministic, no UUID dependency)
    const userId = `user_${body.email.replace(/[^a-z0-9]/gi, '_')}`;

    // Create user profile
    const { error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: userId,
        email: body.email,
        name: body.name,
        password_hash: passwordHash,
        profile_completeness: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      logger.error('Signup DB error', { err: insertError.message, email: body.email });
      return res.status(500).json({ error: 'Could not create account. Please try again.' });
    }

    const token = issueToken(userId);
    logger.info('User signed up', { userId: userId.slice(0, 12) + '...' });

    res.status(201).json({
      token,
      expiresIn: '30d',
      userId,
      message: 'Account created successfully.',
    });
  } catch (err) {
    logger.error('Signup failed', { err: err.message });
    res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

// ─── POST /login ────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  if (!checkIPLimit(clientIP)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const { data: body, error: valError } = validate(loginSchema, req.body);
  if (valError) {
    return res.status(400).json({ error: valError });
  }

  try {
    // Find user by email
    const { data: user, error: findError } = await supabase
      .from('user_profiles')
      .select('user_id, password_hash, name')
      .eq('email', body.email)
      .single();

    if (findError || !user || !user.password_hash) {
      // Deliberately vague — don't reveal whether email exists
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify password
    const valid = await bcrypt.compare(body.password, user.password_hash);
    if (!valid) {
      logger.warn('Login failed — wrong password', { ip: clientIP });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = issueToken(user.user_id);
    logger.info('User logged in', { userId: user.user_id.slice(0, 12) + '...' });

    res.json({
      token,
      expiresIn: '30d',
      userId: user.user_id,
      name: user.name,
    });
  } catch (err) {
    logger.error('Login failed', { err: err.message });
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ─── POST /token (legacy bootstrap — admin/dev only) ───────────────────────

router.post('/token', (req, res) => {
  const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  if (!checkIPLimit(clientIP)) {
    logger.warn('Auth rate limit exceeded', { ip: clientIP });
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const { userId, secret } = req.body;

  if (!BOOTSTRAP_SECRET) {
    return res.status(503).json({ error: 'Bootstrap auth not configured.' });
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
    logger.info('Bootstrap token issued', { userId: userId.trim().slice(0, 8) + '...' });
    res.json({ token, expiresIn: '30d' });
  } catch (err) {
    logger.error('Token issuance failed', { err: err.message });
    res.status(500).json({ error: 'Could not issue token.' });
  }
});

module.exports = router;
