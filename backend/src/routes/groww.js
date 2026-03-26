'use strict';

// Groww Trade API broker integration — REST-based, no SDK
// Auth: API Key + SHA256 checksum → daily Bearer access token (resets at 6 AM IST)
//
// Endpoints:
//   POST /api/groww/connect        → save API key + secret, validate + get access token
//   GET  /api/groww/portfolio      → fetch holdings
//   GET  /api/groww/status         → { connected: bool }
//   POST /api/groww/disconnect     → clear token

const express = require('express');
const crypto  = require('crypto');
const axios   = require('axios');
const repos   = require('../repositories');
const logger  = require('../lib/logger');

const router = express.Router();

const BASE_URL = 'https://api.groww.in/v1';

// ── Per-user token cache ──────────────────────────────────────────────────────
// Groww tokens expire at 6 AM IST every day — cache until next 6 AM IST

const tokenCache = new Map();

function nextSixAmIST() {
  const now = new Date();
  // IST = UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);

  const next6am = new Date(ist);
  next6am.setUTCHours(0, 30, 0, 0); // 6 AM IST = 00:30 UTC
  if (ist >= next6am) {
    next6am.setUTCDate(next6am.getUTCDate() + 1);
  }
  return next6am.getTime();
}

async function getAccessToken(userId) {
  if (!userId) return null;
  const key    = `${userId}:groww`;
  const cached = tokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  // Try to load stored credentials and re-auth
  const { data } = await repos.connectedApps.loadToken(userId, 'groww');
  if (!data?.access_token) return null;

  // Check if stored token is still fresh (not yet 6 AM IST)
  const expiresAt = nextSixAmIST();
  tokenCache.set(key, { token: data.access_token, expiresAt });
  return data.access_token;
}

function clearTokenCache(userId) {
  tokenCache.delete(`${userId}:groww`);
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

function buildChecksum(apiSecret, timestamp) {
  return crypto
    .createHash('sha256')
    .update(`${apiSecret}${timestamp}`)
    .digest('hex');
}

async function fetchNewAccessToken(apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const checksum  = buildChecksum(apiSecret, timestamp);

  const response = await axios.post(
    `${BASE_URL}/token/api/access`,
    { key_type: 'approval', checksum, timestamp },
    {
      headers: {
        Authorization:    `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'X-API-VERSION':  '1.0',
      },
      timeout: 15000,
    }
  );

  const token = response.data?.access_token || response.data?.data?.access_token;
  if (!token) throw new Error('Groww did not return an access_token');
  return token;
}

// ── Connect ───────────────────────────────────────────────────────────────────

// POST /api/groww/connect
// Body: { apiKey, apiSecret }
// Get these from groww.in → Profile → Developer API
router.post('/connect', async (req, res) => {
  const userId = req.userId;
  const { apiKey, apiSecret } = req.body;

  if (!apiKey)    return res.status(400).json({ error: 'apiKey is required' });
  if (!apiSecret) return res.status(400).json({ error: 'apiSecret is required' });

  try {
    const token = await fetchNewAccessToken(apiKey, apiSecret);

    // Store: access_token = Bearer token, refresh_token = apiKey:apiSecret (for re-auth at 6 AM)
    await repos.connectedApps.saveToken(userId, 'groww', {
      accessToken:  token,
      refreshToken: `${apiKey}:${apiSecret}`,
    });

    const expiresAt = nextSixAmIST();
    tokenCache.set(`${userId}:groww`, { token, expiresAt });

    logger.info('Groww connected successfully', { userId });
    res.json({ success: true, message: 'Groww connected!' });
  } catch (err) {
    const status = err.response?.status;
    const msg    = err.response?.data?.message || err.message;
    logger.error('Groww connect error', { userId, err: msg });

    if (status === 401 || status === 403) {
      return res.status(401).json({ error: `Groww auth failed: ${msg}. Check your API key and secret.` });
    }
    res.status(500).json({ error: `Groww connection failed: ${msg}` });
  }
});

// ── Portfolio ─────────────────────────────────────────────────────────────────

async function fetchHoldings(userId) {
  let token = await getAccessToken(userId);

  if (!token) {
    // Try re-auth with stored credentials
    const { data } = await repos.connectedApps.loadToken(userId, 'groww');
    const creds = data?.refresh_token; // format: "apiKey:apiSecret"
    if (!creds) throw new Error('Groww not connected');

    const [apiKey, ...rest] = creds.split(':');
    const apiSecret = rest.join(':'); // handle colons in secret
    token = await fetchNewAccessToken(apiKey, apiSecret);

    // Re-save fresh token
    await repos.connectedApps.saveToken(userId, 'groww', {
      accessToken:  token,
      refreshToken: creds,
    });
    const key = `${userId}:groww`;
    tokenCache.set(key, { token, expiresAt: nextSixAmIST() });
  }

  const response = await axios.get(`${BASE_URL}/holdings/user`, {
    headers: {
      Authorization:   `Bearer ${token}`,
      'X-API-VERSION': '1.0',
    },
    timeout: 15000,
  });

  const raw = response.data?.data?.holdings || response.data?.holdings || [];
  return raw.map(h => ({
    symbol:        h.trading_symbol || h.tradingSymbol || h.isin,
    name:          h.company_name   || h.companyName  || h.trading_symbol,
    qty:           h.quantity       || h.holdingQuantity || 0,
    buy_price:     parseFloat((h.average_price || h.avgCostPrice || 0).toFixed(2)),
    current_price: parseFloat((h.ltp || h.last_price || 0).toFixed(2)),
    broker:        'Groww',
  }));
}

// GET /api/groww/portfolio
router.get('/portfolio', async (req, res) => {
  const userId = req.userId;
  const token  = await getAccessToken(userId);

  if (!token) {
    return res.status(401).json({
      error:  'Groww not connected. POST /api/groww/connect with your apiKey and apiSecret.',
      action: 'connect_groww',
    });
  }

  try {
    const holdings = await fetchHoldings(userId);

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
      brokers_connected: ['Groww'],
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      clearTokenCache(userId);
      return res.status(401).json({ error: 'Groww session expired. Please reconnect.', reconnect: true });
    }
    logger.error('Groww portfolio fetch error', { userId, err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Status / disconnect ───────────────────────────────────────────────────────

router.get('/status', async (req, res) => {
  const token = await getAccessToken(req.userId);
  res.json({ connected: !!token });
});

router.post('/disconnect', async (req, res) => {
  const userId = req.userId;
  clearTokenCache(userId);
  await repos.connectedApps.deleteToken(userId, 'groww');
  res.json({ success: true });
});

module.exports        = router;
module.exports.getAccessToken = getAccessToken;
module.exports.fetchHoldings  = fetchHoldings;
