'use strict';

// Upstox OAuth2 broker integration — uses official upstox-js-sdk v2
// Same pattern as zerodha.js (OAuth flow + token storage + exports for brokers/index.js)
//
// Flow:
//   1. GET /api/upstox/login       → redirect to Upstox authorization dialog
//   2. GET /api/upstox/callback    → exchange code for access_token, store in Supabase
//   3. GET /api/upstox/portfolio   → fetch long-term holdings via SDK
//   4. GET /api/upstox/status      → { connected: bool }
//   5. POST /api/upstox/disconnect → clear token

const express  = require('express');
const axios    = require('axios');
const { ApiClient, PortfolioApi } = require('upstox-js-sdk');
const repos    = require('../repositories');
const logger   = require('../lib/logger');
const { generateState, validateState } = require('../lib/oauthState');

const router = express.Router();

const UPSTOX_AUTH_URL  = 'https://api.upstox.com/v2/login/authorization/dialog';
const UPSTOX_TOKEN_URL = 'https://api.upstox.com/v2/login/authorization/token';

// In-memory token — loaded from Supabase on startup so it survives restarts
let accessToken = null;

// Set token on the SDK singleton so all API calls pick it up automatically
function setSDKToken(token) {
  const oauth2 = ApiClient.instance.authentications['OAUTH2'];
  oauth2.accessToken = token;
}

async function loadTokenFromDB() {
  const { data } = await repos.connectedApps.loadToken('default_user', 'upstox');
  if (data?.access_token) {
    accessToken = data.access_token;
    setSDKToken(accessToken);
    logger.info('Upstox token loaded from Supabase');
  }
}

loadTokenFromDB().catch(err => logger.error('Upstox token load failed', { err: err.message }));

// ── Step 1: Login redirect ──────────────────────────────────────────────────

// GET /api/upstox/login
router.get('/login', (req, res) => {
  const state = generateState();
  const params = new URLSearchParams({
    client_id:     process.env.UPSTOX_API_KEY,
    redirect_uri:  process.env.UPSTOX_REDIRECT_URI,
    response_type: 'code',
    state,
  });

  const loginUrl = `${UPSTOX_AUTH_URL}?${params.toString()}`;

  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.json({ loginUrl });
  }
  res.redirect(loginUrl);
});

// ── Step 2: OAuth callback ──────────────────────────────────────────────────

// GET /api/upstox/callback?code=XXXX
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!validateState(state)) {
    return res.status(403).send('Invalid or expired OAuth state. Please try connecting again.');
  }
  if (!code) return res.status(400).send('Missing authorization code');

  try {
    const response = await axios.post(
      UPSTOX_TOKEN_URL,
      new URLSearchParams({
        code,
        client_id:     process.env.UPSTOX_API_KEY,
        client_secret: process.env.UPSTOX_API_SECRET,
        redirect_uri:  process.env.UPSTOX_REDIRECT_URI,
        grant_type:    'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    accessToken = response.data.access_token;
    setSDKToken(accessToken);

    await repos.connectedApps.saveToken('default_user', 'upstox', {
      accessToken,
      refreshToken: response.data.extended_token || null,
    });

    logger.info('Upstox connected successfully');

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#2D1B14;color:#F5F0EB">
        <h2 style="color:#FFE36D">✅ Upstox Connected!</h2>
        <p>Your portfolio is now linked to OpenClutch.</p>
        <p>Close this tab and go back to the chat.</p>
        <script>setTimeout(() => window.close(), 3000)</script>
      </body></html>
    `);
  } catch (err) {
    logger.error('Upstox OAuth callback error', { err: err.message });
    res.status(500).send(`Upstox auth failed: ${err.response?.data?.message || err.message}`);
  }
});

// ── Portfolio ───────────────────────────────────────────────────────────────

// GET /api/upstox/portfolio
router.get('/portfolio', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({
      error:  'Upstox not connected. Visit /api/upstox/login first.',
      action: 'connect_upstox',
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
      brokers_connected: ['Upstox'],
    });
  } catch (err) {
    if (isTokenExpired(err)) {
      accessToken = null;
      setSDKToken('');
      return res.status(401).json({ error: 'Upstox session expired. Please reconnect.', reconnect: true });
    }
    logger.error('Upstox portfolio fetch error', { err: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Status / disconnect ─────────────────────────────────────────────────────

router.get('/status', (req, res) => {
  res.json({ connected: !!accessToken });
});

router.post('/disconnect', async (req, res) => {
  accessToken = null;
  setSDKToken('');
  await repos.connectedApps.deleteToken('default_user', 'upstox');
  res.json({ success: true });
});

// ── Shared helper (used by brokers/index.js adapter) ───────────────────────

async function fetchHoldings() {
  return new Promise((resolve, reject) => {
    const portfolioApi = new PortfolioApi();
    portfolioApi.getHoldings(process.env.UPSTOX_API_VERSION || '2.0', (err, data) => {
      if (err) return reject(err);
      const holdings = (data?.data || []).map(h => ({
        symbol:        h.trading_symbol,
        name:          h.company_name || h.trading_symbol,
        qty:           h.quantity,
        buy_price:     parseFloat((h.average_price || 0).toFixed(2)),
        current_price: parseFloat((h.last_price    || 0).toFixed(2)),
        broker:        'Upstox',
      }));
      resolve(holdings);
    });
  });
}

function isTokenExpired(err) {
  const msg = err?.message || '';
  return msg.includes('UDAPI100011') || msg.includes('Access token') || msg.includes('Unauthorized');
}

function getAccessToken() { return accessToken; }

module.exports = router;
module.exports.getAccessToken = getAccessToken;
module.exports.fetchHoldings  = fetchHoldings;
