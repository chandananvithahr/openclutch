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

// In-memory state — loaded from Supabase on startup
let accessToken = null;
let clientCode  = null;

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

async function loadTokenFromDB() {
  const { data } = await repos.connectedApps.loadToken('default_user', 'fivepaisa');
  if (data?.access_token) {
    accessToken = data.access_token;
    clientCode  = data.refresh_token || '';
    logger.info('5paisa token loaded from Supabase');
  }
}

loadTokenFromDB().catch(err => logger.error('5paisa token load failed', { err: err.message }));

// ── Connect ─────────────────────────────────────────────────────────────────

// POST /api/fivepaisa/connect
// Body: { totp, pin, clientCode }
// User gets TOTP from their authenticator app + 5paisa PIN
router.post('/connect', async (req, res) => {
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

    accessToken = token;
    clientCode  = code;

    // Store clientCode in refresh_token column
    await repos.connectedApps.saveToken('default_user', 'fivepaisa', {
      accessToken: token,
      refreshToken: code,
    });

    logger.info('5paisa connected successfully');
    res.json({ success: true, message: '5paisa connected!' });
  } catch (err) {
    logger.error('5paisa connect error', { err: err.message });
    res.status(401).json({ error: `5paisa connection failed: ${err.message}` });
  }
});

// ── Portfolio ───────────────────────────────────────────────────────────────

// GET /api/fivepaisa/portfolio
router.get('/portfolio', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({
      error:  '5paisa not connected. POST /api/fivepaisa/connect with your TOTP and PIN.',
      action: 'connect_fivepaisa',
    });
  }

  try {
    const holdings = await fetchHoldings();

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
      accessToken = null;
      clientCode  = null;
      return res.status(401).json({ error: '5paisa session expired. Please reconnect.', reconnect: true });
    }
    logger.error('5paisa portfolio fetch error', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Status / disconnect ─────────────────────────────────────────────────────

router.get('/status', (req, res) => {
  res.json({ connected: !!accessToken });
});

router.post('/disconnect', async (req, res) => {
  accessToken = null;
  clientCode  = null;
  await repos.connectedApps.deleteToken('default_user', 'fivepaisa');
  res.json({ success: true });
});

// ── Shared helper (used by brokers/index.js adapter) ───────────────────────

async function fetchHoldings() {
  const response = await axios.post(
    HOLDINGS_ENDPOINT,
    {
      head: { key: process.env.FIVEPAISA_USER_KEY },
      body: { ClientCode: clientCode },
    },
    {
      headers: {
        Authorization:  `Bearer ${accessToken}`,
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

function getAccessToken() { return accessToken; }

module.exports = router;
module.exports.getAccessToken = getAccessToken;
module.exports.fetchHoldings  = fetchHoldings;
