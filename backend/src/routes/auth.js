'use strict';

// POST /api/auth/token — issue a JWT for a given userId
// In production this will be replaced by proper Supabase Auth / OTP verification.
// For now it's a bootstrap endpoint so mobile can get a token to authenticate all other calls.
//
// Body: { userId: string }   (must be non-empty)
// Returns: { token: string, expiresIn: "30d" }

const express = require('express');
const router  = express.Router();
const { issueToken } = require('../middleware/auth');
const logger  = require('../lib/logger');

router.post('/token', (req, res) => {
  const { userId } = req.body;

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (userId.trim().length > 128) {
    return res.status(400).json({ error: 'userId too long' });
  }

  try {
    const token = issueToken(userId.trim());
    logger.info('Token issued', { userId: userId.trim() });
    res.json({ token, expiresIn: '30d' });
  } catch (err) {
    logger.error('Token issuance failed', { err: err.message });
    res.status(500).json({ error: 'Could not issue token. JWT_SECRET may not be configured.' });
  }
});

module.exports = router;
