'use strict';

// Fyers OAuth2 broker integration — uses official fyers-api-v3 SDK
// Same pattern as zerodha.js / upstox.js
//
// Flow:
//   1. GET /api/fyers/login       → redirect to Fyers authorization dialog
//   2. GET /api/fyers/callback    → exchange auth_code for access_token, store in Supabase
//   3. GET /api/fyers/portfolio   → fetch holdings via SDK
//   4. GET /api/fyers/status      → { connected: bool }
//   5. POST /api/fyers/disconnect → clear token

const express = require('express');
const { fyersModel } = require('fyers-api-v3');
const repos  = require('../repositories');
const logger = require('../lib/logger');
const { generateState, validateState } = require('../lib/oauthState');

const router = express.Router();

// In-memory token — loaded from Supabase on startup
let accessToken = null;
let fyersClient = null;

function createClient(token) {
  const fyers = new fyersModel();
  fyers.setAppId(process.env.FYERS_APP_ID);
  fyers.setRedirectUrl(process.env.FYERS_REDIRECT_URI);
  fyers.setAccessToken(token);
  return fyers;
}

async function loadTokenFromDB() {
  const { data } = await repos.connectedApps.loadToken('default_user', 'fyers');
  if (data?.access_token) {
    accessToken  = data.access_token;
    fyersClient  = createClient(accessToken);
    logger.info('Fyers token loaded from Supabase');
  }
}

loadTokenFromDB().catch(err => logger.error('Fyers token load failed', { err: err.message }));

// ── Step 1: Login redirect ──────────────────────────────────────────────────

// GET /api/fyers/login
router.get('/login', (req, res) => {
  const state = generateState();
  const fyers = new fyersModel();
  fyers.setAppId(process.env.FYERS_APP_ID);
  fyers.setRedirectUrl(process.env.FYERS_REDIRECT_URI);
  fyers.setStateValue(state);

  const loginUrl = fyers.generateAuthCode();

  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.json({ loginUrl });
  }
  res.redirect(loginUrl);
});

// ── Step 2: OAuth callback ──────────────────────────────────────────────────

// GET /api/fyers/callback?auth_code=XXXX&state=sample_state
router.get('/callback', async (req, res) => {
  const { auth_code, state } = req.query;
  if (!validateState(state)) {
    return res.status(403).send('Invalid or expired OAuth state. Please try connecting again.');
  }
  if (!auth_code) return res.status(400).send('Missing auth_code from Fyers');

  try {
    const fyers = new fyersModel();
    fyers.setAppId(process.env.FYERS_APP_ID);
    fyers.setRedirectUrl(process.env.FYERS_REDIRECT_URI);

    const response = await fyers.generate_access_token({
      client_id:  process.env.FYERS_APP_ID,
      secret_key: process.env.FYERS_SECRET_ID,
      auth_code,
    });

    if (!response?.access_token) {
      logger.error('Fyers token exchange failed', { response });
      return res.status(401).send('Fyers auth failed — no access token returned');
    }

    accessToken = response.access_token;
    fyersClient = createClient(accessToken);

    await repos.connectedApps.saveToken('default_user', 'fyers', { accessToken });

    logger.info('Fyers connected successfully');

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#2D1B14;color:#F5F0EB">
        <h2 style="color:#FFE36D">✅ Fyers Connected!</h2>
        <p>Your portfolio is now linked to OpenClutch.</p>
        <p>Close this tab and go back to the chat.</p>
        <script>setTimeout(() => window.close(), 3000)</script>
      </body></html>
    `);
  } catch (err) {
    logger.error('Fyers OAuth callback error', { err: err.message });
    res.status(500).send(`Fyers auth failed: ${err.message}`);
  }
});

// ── Portfolio ───────────────────────────────────────────────────────────────

// GET /api/fyers/portfolio
router.get('/portfolio', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({
      error:  'Fyers not connected. Visit /api/fyers/login first.',
      action: 'connect_fyers',
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
      brokers_connected: ['Fyers'],
    });
  } catch (err) {
    if (isTokenExpired(err)) {
      accessToken = null;
      fyersClient = null;
      return res.status(401).json({ error: 'Fyers session expired. Please reconnect.', reconnect: true });
    }
    logger.error('Fyers portfolio fetch error', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Status / disconnect ─────────────────────────────────────────────────────

router.get('/status', (req, res) => {
  res.json({ connected: !!accessToken });
});

router.post('/disconnect', async (req, res) => {
  accessToken = null;
  fyersClient = null;
  await repos.connectedApps.deleteToken('default_user', 'fyers');
  res.json({ success: true });
});

// ── Shared helper (used by brokers/index.js adapter) ───────────────────────

async function fetchHoldings() {
  const response = await fyersClient.get_holdings();

  if (response?.s !== 'ok') {
    throw new Error(response?.message || 'Fyers holdings fetch failed');
  }

  return (response?.holdings || []).map(h => ({
    symbol:        h.symbol?.split(':')[1] || h.symbol, // strip "NSE:" prefix
    name:          h.holdingType || h.symbol,
    qty:           h.quantity,
    buy_price:     parseFloat((h.costPrice  || 0).toFixed(2)),
    current_price: parseFloat((h.ltp        || 0).toFixed(2)),
    broker:        'Fyers',
  }));
}

function isTokenExpired(err) {
  const msg = err?.message || '';
  return msg.includes('token') || msg.includes('Unauthorized') || msg.includes('Invalid');
}

function getAccessToken() { return accessToken; }

module.exports = router;
module.exports.getAccessToken = getAccessToken;
module.exports.fetchHoldings  = fetchHoldings;
