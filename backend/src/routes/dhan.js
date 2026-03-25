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

// In-memory state — loaded from Supabase on startup
let accessToken = null;
let clientId    = null;
let dhanClient  = null;

function createClient(token, id) {
  return new DhanHqClient({ accessToken: token, clientId: id });
}

async function loadTokenFromDB() {
  const { data } = await repos.connectedApps.loadToken('default_user', 'dhan');
  if (data?.access_token) {
    // Store clientId in refresh_token field (repurposed for non-OAuth brokers)
    accessToken = data.access_token;
    clientId    = data.refresh_token || '';
    dhanClient  = createClient(accessToken, clientId);
    logger.info('Dhan token loaded from Supabase');
  }
}

loadTokenFromDB().catch(err => logger.error('Dhan token load failed', { err: err.message }));

// ── Connect (token auth — no OAuth redirect needed) ─────────────────────────

// POST /api/dhan/connect
// Body: { accessToken, clientId }
// User gets these from DhanHQ → My Profile → Apps & Credentials
router.post('/connect', async (req, res) => {
  const { accessToken: token, clientId: id } = req.body;

  if (!token) return res.status(400).json({ error: 'accessToken is required' });
  if (!id)    return res.status(400).json({ error: 'clientId is required' });

  try {
    // Test credentials by fetching holdings before saving
    const testClient = createClient(token, id);
    await testClient.getHoldings(); // throws if invalid

    accessToken = token;
    clientId    = id;
    dhanClient  = createClient(accessToken, clientId);

    // Store clientId in refresh_token column (it's not a secret, just an ID)
    await repos.connectedApps.saveToken('default_user', 'dhan', {
      accessToken: token,
      refreshToken: id,
    });

    logger.info('Dhan connected successfully');
    res.json({ success: true, message: 'Dhan connected!' });
  } catch (err) {
    logger.error('Dhan connect error', { err: err.message });
    res.status(401).json({ error: `Dhan connection failed: ${err.message}. Check your access token and client ID.` });
  }
});

// ── Portfolio ───────────────────────────────────────────────────────────────

// GET /api/dhan/portfolio
router.get('/portfolio', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({
      error:  'Dhan not connected. POST /api/dhan/connect with your accessToken and clientId.',
      action: 'connect_dhan',
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
      brokers_connected: ['Dhan'],
    });
  } catch (err) {
    if (isTokenExpired(err)) {
      accessToken = null;
      dhanClient  = null;
      return res.status(401).json({ error: 'Dhan token expired. Please reconnect.', reconnect: true });
    }
    logger.error('Dhan portfolio fetch error', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Status / disconnect ─────────────────────────────────────────────────────

router.get('/status', (req, res) => {
  res.json({ connected: !!accessToken });
});

router.post('/disconnect', async (req, res) => {
  accessToken = null;
  clientId    = null;
  dhanClient  = null;
  await repos.connectedApps.deleteToken('default_user', 'dhan');
  res.json({ success: true });
});

// ── Shared helper (used by brokers/index.js adapter) ───────────────────────

async function fetchHoldings() {
  const response = await dhanClient.getHoldings();

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

function isTokenExpired(err) {
  const msg = err?.message || '';
  return msg.includes('access-token') || msg.includes('Unauthorized') || msg.includes('800');
}

function getAccessToken() { return accessToken; }

module.exports = router;
module.exports.getAccessToken = getAccessToken;
module.exports.fetchHoldings  = fetchHoldings;
