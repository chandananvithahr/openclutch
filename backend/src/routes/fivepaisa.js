'use strict';

// 5paisa broker integration — 5paisa-ts-sdk for auth, axios for holdings
// Auth: TOTP + PIN flow (similar to Angel One)
// The ts-sdk handles auth; holdings are fetched directly via 5paisa REST API
//
// Endpoints:
//   POST /api/fivepaisa/connect   → { totp, pin } → gets + stores access token
//   GET  /api/fivepaisa/portfolio → fetch holdings
//   GET  /api/fivepaisa/status    → { connected: bool }
//   POST /api/fivepaisa/disconnect → clear token

const express = require('express');
const axios   = require('axios');
const { FivePaisaClient } = require('5paisa-ts-sdk');
const repos  = require('../repositories');
const logger = require('../lib/logger');

const router = express.Router();

const FIVEPAISA_BASE     = 'https://Openapi.5paisa.com/VendorsAPI/Service1.svc';
const HOLDINGS_ENDPOINT  = `${FIVEPAISA_BASE}/V4/Holding`;

// ── Per-user token cache ────────────────────────────────────────────────────

const tokenCache = new Map();
const TOKEN_TTL  = 30 * 60 * 1000; // 30 minutes

async function getAccessToken(userId) {
  if (!userId) return null;
  const key    = `${userId}:fivepaisa`;
  const cached = tokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const { data } = await repos.connectedApps.loadToken(userId, 'fivepaisa');
  if (data?.access_token) {
    tokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + TOKEN_TTL });
    return data.access_token;
  }
  return null;
}

function clearTokenCache(userId) {
  tokenCache.delete(`${userId}:fivepaisa`);
}

// ── SDK factory ─────────────────────────────────────────────────────────────

function makeSdkClient() {
  return new FivePaisaClient({
    appName:       process.env.FIVEPAISA_APP_NAME,
    appSource:     process.env.FIVEPAISA_APP_SOURCE,
    userId:        process.env.FIVEPAISA_USER_ID || '',
    password:      process.env.FIVEPAISA_PASSWORD || '',
    userKey:       process.env.FIVEPAISA_USER_KEY,
    encryptionKey: process.env.FIVEPAISA_ENCRYPTION_KEY,
  });
}

// ── Connect ─────────────────────────────────────────────────────────────────

// POST /api/fivepaisa/connect
// Body: { totp, pin, clientCode }
// User gets TOTP from their authenticator app + 5paisa PIN
router.post('/connect', async (req, res) => {
  const userId = req.userId;
  const { totp, pin, clientCode: code } = req.body;

  if (!totp) return res.status(400).json({ error: 'totp is required' });
  if (!pin)  return res.status(400).json({ error: 'pin is required' });
  if (!code) return res.status(400).json({ error: 'clientCode is required' });

  try {
    const sdk = makeSdkClient();

    const requestToken = await sdk.auth.getRequestToken(totp, pin);
    if (!requestToken) {
      return res.status(401).json({ error: '5paisa login failed — check your TOTP and PIN' });
    }

    const tokenResponse = await sdk.auth.getAccessToken(requestToken);
    const token = tokenResponse?.jwt || sdk.auth.jwt;

    if (!token) {
      return res.status(401).json({ error: '5paisa access token not returned' });
    }

    // Store clientCode in refresh_token column
    await repos.connectedApps.saveToken(userId, 'fivepaisa', {
      accessToken:  token,
      refreshToken: code,
    });

    // Populate cache immediately
    tokenCache.set(`${userId}:fivepaisa`, { token, expiresAt: Date.now() + TOKEN_TTL });

    logger.info('5paisa connected successfully', { userId });
    res.json({ success: true, message: '5paisa connected!' });
  } catch (err) {
    logger.error('5paisa connect error', { userId, err: err.message });
    res.status(401).json({ error: `5paisa connection failed: ${err.message}` });
  }
});

// ── Portfolio ───────────────────────────────────────────────────────────────

// GET /api/fivepaisa/portfolio
router.get('/portfolio', async (req, res) => {
  const userId = req.userId;
  const token  = await getAccessToken(userId);

  if (!token) {
    return res.status(401).json({
      error:  '5paisa not connected. POST /api/fivepaisa/connect with your TOTP and PIN.',
      action: 'connect_fivepaisa',
    });
  }

  try {
    const { data: appData } = await repos.connectedApps.loadToken(userId, 'fivepaisa');
    const code = appData?.refresh_token || '';

    const holdings = await fetchHoldings(token, code);

    let totalValue    = 0;
    let totalInvested = 0;

    const formatted = holdings.map(h => {
      const cv  = h.current_price * h.qty;
      const iv  = h.buy_price * h.qty;
      const pnl = cv - iv;
      totalValue    += cv;
      totalInvested += iv;
      return {
        ...h,
        pnl:         parseFloat(pnl.toFixed(2)),
        pnl_percent: iv > 0 ? parseFloat(((pnl / iv) * 100).toFixed(2)) : 0,
      };
    });

    const pnl = totalValue - totalInvested;

    res.json({
      total_value:       parseFloat(totalValue.toFixed(2)),
      total_invested:    parseFloat(totalInvested.toFixed(2)),
      total_pnl:         parseFloat(pnl.toFixed(2)),
      total_pnl_percent: totalInvested > 0
        ? parseFloat(((pnl / totalInvested) * 100).toFixed(2))
        : 0,
      holdings:          formatted,
      brokers_connected: ['5paisa'],
    });
  } catch (err) {
    if (isTokenExpired(err)) {
      clearTokenCache(userId);
      return res.status(401).json({ error: '5paisa session expired. Please reconnect.', reconnect: true });
    }
    logger.error('5paisa portfolio fetch error', { userId, err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Status / disconnect ─────────────────────────────────────────────────────

router.get('/status', async (req, res) => {
  const token = await getAccessToken(req.userId);
  res.json({ connected: !!token });
});

router.post('/disconnect', async (req, res) => {
  const userId = req.userId;
  clearTokenCache(userId);
  await repos.connectedApps.deleteToken(userId, 'fivepaisa');
  res.json({ success: true });
});

// ── Shared helper (used by brokers/index.js adapter) ───────────────────────

async function fetchHoldings(token, clientCode) {
  const response = await axios.post(
    HOLDINGS_ENDPOINT,
    {
      head: { key: process.env.FIVEPAISA_USER_KEY },
      body: { ClientCode: clientCode },
    },
    {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = response.data?.body?.Data || [];

  return data.map(h => ({
    symbol:        h.Symbol || h.ScripCode?.toString(),
    name:          h.FullName || h.Symbol,
    qty:           h.Quantity,
    buy_price:     parseFloat((h.AvgRate  || 0).toFixed(2)),
    current_price: parseFloat((h.LastRate || 0).toFixed(2)),
    broker:        '5paisa',
  }));
}

function isTokenExpired(err) {
  const status = err?.response?.status;
  const msg    = err?.message || '';
  return status === 401 || msg.includes('token') || msg.includes('Unauthorized');
}

module.exports = router;
module.exports.getAccessToken = getAccessToken;
module.exports.fetchHoldings  = fetchHoldings;
