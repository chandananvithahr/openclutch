'use strict';

// Dhan broker integration — uses official dhanhq SDK
// Auth: token-based (no OAuth). User pastes their access token from DhanHQ portal.
// Same portfolio pattern as other brokers.
//
// Endpoints:
//   POST /api/dhan/connect        → save access token + client ID
//   GET  /api/dhan/portfolio      → fetch holdings via SDK
//   GET  /api/dhan/status         → { connected: bool }
//   POST /api/dhan/disconnect     → clear token

const express = require('express');
const { DhanHqClient } = require('dhanhq');
const repos  = require('../repositories');
const logger = require('../lib/logger');

const router = express.Router();

// ── Per-user token cache ─────────────────────────────────────────────────────

const tokenCache = new Map();
const TOKEN_TTL  = 30 * 60 * 1000; // 30 minutes

async function getAccessToken(userId) {
  if (!userId) return null;
  const key    = `${userId}:dhan`;
  const cached = tokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const { data } = await repos.connectedApps.loadToken(userId, 'dhan');
  if (data?.access_token) {
    tokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + TOKEN_TTL });
    return data.access_token;
  }
  return null;
}

function clearTokenCache(userId) {
  tokenCache.delete(`${userId}:dhan`);
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function createClient(token, id) {
  return new DhanHqClient({ accessToken: token, clientId: id });
}

function isTokenExpired(err) {
  const msg = err?.message || '';
  return msg.includes('access-token') || msg.includes('Unauthorized') || msg.includes('800');
}

async function fetchHoldings(userId) {
  const token = await getAccessToken(userId);
  if (!token) throw new Error('Dhan not connected');
  // Load clientId from DB (stored in refresh_token column)
  const { data } = await repos.connectedApps.loadToken(userId, 'dhan');
  const id = data?.refresh_token || '';
  const client = createClient(token, id);
  const response = await client.getHoldings();

  // SDK returns { data: [...] } or throws on auth error
  return (response?.data || []).map(h => ({
    symbol:        h.tradingSymbol,
    name:          h.tradingSymbol,
    qty:           h.totalQty,
    buy_price:     parseFloat((h.avgCostPrice || 0).toFixed(2)),
    current_price: parseFloat((h.ltp          || 0).toFixed(2)),
    broker:        'Dhan',
  }));
}

// ── Connect (token auth — no OAuth redirect needed) ─────────────────────────

// POST /api/dhan/connect
// Body: { accessToken, clientId }
// User gets these from DhanHQ → My Profile → Apps & Credentials
router.post('/connect', async (req, res) => {
  const userId = req.userId;
  const { accessToken: token, clientId: id } = req.body;

  if (!token) return res.status(400).json({ error: 'accessToken is required' });
  if (!id)    return res.status(400).json({ error: 'clientId is required' });

  try {
    // Test credentials by fetching holdings before saving
    const testClient = createClient(token, id);
    await testClient.getHoldings(); // throws if invalid

    // Store clientId in refresh_token column (it's not a secret, just an ID)
    await repos.connectedApps.saveToken(userId, 'dhan', {
      accessToken:  token,
      refreshToken: id,
    });

    // Populate cache immediately
    const key = `${userId}:dhan`;
    tokenCache.set(key, { token, expiresAt: Date.now() + TOKEN_TTL });

    logger.info('Dhan connected successfully', { userId });
    res.json({ success: true, message: 'Dhan connected!' });
  } catch (err) {
    logger.error('Dhan connect error', { userId, err: err.message });
    res.status(401).json({ error: `Dhan connection failed: ${err.message}. Check your access token and client ID.` });
  }
});

// ── Portfolio ───────────────────────────────────────────────────────────────

// GET /api/dhan/portfolio
router.get('/portfolio', async (req, res) => {
  const userId = req.userId;
  const token  = await getAccessToken(userId);

  if (!token) {
    return res.status(401).json({
      error:  'Dhan not connected. POST /api/dhan/connect with your accessToken and clientId.',
      action: 'connect_dhan',
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
      brokers_connected: ['Dhan'],
    });
  } catch (err) {
    if (isTokenExpired(err)) {
      clearTokenCache(userId);
      return res.status(401).json({ error: 'Dhan token expired. Please reconnect.', reconnect: true });
    }
    logger.error('Dhan portfolio fetch error', { userId, err: err.message });
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
  await repos.connectedApps.deleteToken(userId, 'dhan');
  res.json({ success: true });
});

module.exports        = router;
module.exports.getAccessToken = getAccessToken;
module.exports.fetchHoldings  = fetchHoldings;
