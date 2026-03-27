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

const PRODUCTION_REDIRECT = 'https://humble-blessing-production.up.railway.app/api/upstox/callback';
function getRedirectUri(req) {
  if (process.env.UPSTOX_REDIRECT_URI) return process.env.UPSTOX_REDIRECT_URI;
  if (!req) return PRODUCTION_REDIRECT;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${protocol}://${host}/api/upstox/callback`;
}

const { BoundedMap } = require('../lib/bounded-map');
// Per-user token cache
const tokenCache = new BoundedMap(10_000);
const TOKEN_TTL = 30 * 60 * 1000;

async function getAccessToken(userId) {
  if (!userId) return null;
  const key = `${userId}:upstox`;
  const cached = tokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const { data } = await repos.connectedApps.loadToken(userId, 'upstox');
  if (data?.access_token) {
    tokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + TOKEN_TTL });
    return data.access_token;
  }
  return null;
}

function clearTokenCache(userId) {
  tokenCache.delete(`${userId}:upstox`);
}

// Create a per-request ApiClient to avoid singleton race conditions between concurrent users
function createApiClient(token) {
  const client = new ApiClient();
  client.authentications['OAUTH2'].accessToken = token;
  return client;
}

// ── Step 1: Login redirect ──────────────────────────────────────────────────

// GET /api/upstox/login — requires JWT auth
router.get('/login', async (req, res) => {
  const state = await generateState(req.userId);
  const params = new URLSearchParams({
    client_id:     process.env.UPSTOX_API_KEY,
    redirect_uri:  getRedirectUri(req),
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
  const { valid, userId } = await validateState(state);
  if (!valid || !userId) {
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
        redirect_uri:  getRedirectUri(req),
        grant_type:    'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = response.data.access_token;

    await repos.connectedApps.saveToken(userId, 'upstox', {
      accessToken,
      refreshToken: response.data.extended_token || null,
    });
    tokenCache.set(`${userId}:upstox`, { token: accessToken, expiresAt: Date.now() + TOKEN_TTL });

    logger.info('Upstox connected successfully');

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>✅ Upstox Connected!</h2>
        <p>Your portfolio is now linked to Clutch.</p>
        <p>Redirecting back to app...</p>
        <script>setTimeout(() => { window.location.href = 'clutch://connected?service=upstox'; }, 1500)</script>
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
  const userId = req.userId;
  const token = await getAccessToken(userId);
  if (!token) {
    return res.status(401).json({
      error:  'Upstox not connected. Visit /api/upstox/login first.',
      action: 'connect_upstox',
    });
  }

  try {
    const holdings = await fetchHoldings(token);

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
      clearTokenCache(userId);
      return res.status(401).json({ error: 'Upstox session expired. Please reconnect.', reconnect: true });
    }
    logger.error('Upstox portfolio fetch error', { err: err.message });
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
  await repos.connectedApps.deleteToken(userId, 'upstox');
  res.json({ success: true });
});

// ── Shared helper (used by brokers/index.js adapter) ───────────────────────

async function fetchHoldings(token) {
  if (!token) return [];
  const client = createApiClient(token);
  return new Promise((resolve, reject) => {
    const portfolioApi = new PortfolioApi(client);
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

module.exports = router;
module.exports.getAccessToken = getAccessToken;
module.exports.fetchHoldings  = fetchHoldings;
