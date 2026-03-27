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

const PRODUCTION_REDIRECT = 'https://humble-blessing-production.up.railway.app/api/fyers/callback';
function getRedirectUri(req) {
  if (process.env.FYERS_REDIRECT_URI) return process.env.FYERS_REDIRECT_URI;
  if (!req) return PRODUCTION_REDIRECT;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${protocol}://${host}/api/fyers/callback`;
}

const { BoundedMap } = require('../lib/bounded-map');
// Per-user token cache
const tokenCache = new BoundedMap(10_000);
const TOKEN_TTL = 30 * 60 * 1000;

async function getAccessToken(userId) {
  if (!userId) return null;
  const key = `${userId}:fyers`;
  const cached = tokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const { data } = await repos.connectedApps.loadToken(userId, 'fyers');
  if (data?.access_token) {
    tokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + TOKEN_TTL });
    return data.access_token;
  }
  return null;
}

function clearTokenCache(userId) {
  tokenCache.delete(`${userId}:fyers`);
}

function createClient(token, req) {
  const fyers = new fyersModel();
  fyers.setAppId(process.env.FYERS_APP_ID);
  fyers.setRedirectUrl(getRedirectUri(req));
  fyers.setAccessToken(token);
  return fyers;
}

// ── Step 1: Login redirect ──────────────────────────────────────────────────

// GET /api/fyers/login
router.get('/login', async (req, res) => {
  const state = await generateState(req.userId);
  const fyers = new fyersModel();
  fyers.setAppId(process.env.FYERS_APP_ID);
  fyers.setRedirectUrl(getRedirectUri(req));
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

  // Validate OAuth state — NEVER fall back to query params (CSRF protection)
  const { valid, userId } = validateState(state);
  if (!valid || !userId) {
    logger.warn('Fyers callback — invalid or expired OAuth state', { state });
    return res.status(403).send('Invalid or expired OAuth state. Please try connecting again from the app.');
  }
  if (!auth_code) return res.status(400).send('Missing auth_code from Fyers');

  try {
    const fyers = new fyersModel();
    fyers.setAppId(process.env.FYERS_APP_ID);
    fyers.setRedirectUrl(getRedirectUri(req));

    const response = await fyers.generate_access_token({
      client_id:  process.env.FYERS_APP_ID,
      secret_key: process.env.FYERS_SECRET_ID,
      auth_code,
    });

    if (!response?.access_token) {
      logger.error('Fyers token exchange failed', { response });
      return res.status(401).send('Fyers auth failed — no access token returned');
    }

    const token = response.access_token;
    tokenCache.set(`${userId}:fyers`, { token, expiresAt: Date.now() + TOKEN_TTL });

    await repos.connectedApps.saveToken(userId, 'fyers', { accessToken: token });

    logger.info('Fyers connected successfully', { userId });

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>✅ Fyers Connected!</h2>
        <p>Your portfolio is now linked to Clutch.</p>
        <p>Redirecting back to app...</p>
        <script>setTimeout(() => { window.location.href = 'clutch://connected?service=fyers'; }, 1500)</script>
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
  const userId = req.userId;
  const token = await getAccessToken(userId);

  if (!token) {
    return res.status(401).json({
      error:  'Fyers not connected. Visit /api/fyers/login first.',
      action: 'connect_fyers',
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
      brokers_connected: ['Fyers'],
    });
  } catch (err) {
    if (isTokenExpired(err)) {
      clearTokenCache(userId);
      return res.status(401).json({ error: 'Fyers session expired. Please reconnect.', reconnect: true });
    }
    logger.error('Fyers portfolio fetch error', { err: err.message });
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
  await repos.connectedApps.deleteToken(userId, 'fyers');
  res.json({ success: true });
});

// ── Shared helper (used by brokers/index.js adapter) ───────────────────────

async function fetchHoldings(tokenOrUserId) {
  // Accept either a raw token string or a userId (for broker adapter use)
  let token = tokenOrUserId;
  if (!token || typeof token !== 'string' || token.length < 10) {
    return [];
  }

  const fyersClient = createClient(token);
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
  const code = err?.code || err?.s || '';
  // Only match specific Fyers error patterns — not generic words
  return code === '-16' // Fyers invalid token code
    || msg.includes('Invalid token')
    || msg.includes('Token is expired')
    || msg.includes('Access Denied');
}

module.exports = router;
module.exports.getAccessToken = getAccessToken;
module.exports.fetchHoldings  = fetchHoldings;
