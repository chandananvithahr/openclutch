const express = require('express');
const router = express.Router();
const { KiteConnect } = require('kiteconnect');
const repos = require('../repositories');
const logger = require('../lib/logger');
const { generateState, validateState } = require('../lib/oauthState');

// Per-user token cache — replaces the old single-tenant module-level variable
const tokenCache = new Map();
const TOKEN_TTL = 30 * 60 * 1000; // 30 min

async function getAccessToken(userId) {
  if (!userId) return null;
  const key = `${userId}:zerodha`;
  const cached = tokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const { data } = await repos.connectedApps.loadToken(userId, 'zerodha');
  if (data?.access_token) {
    tokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + TOKEN_TTL });
    return data.access_token;
  }
  return null;
}

function clearTokenCache(userId) {
  tokenCache.delete(`${userId}:zerodha`);
}

function createKite(token) {
  const kite = new KiteConnect({ api_key: process.env.ZERODHA_API_KEY });
  if (token) kite.setAccessToken(token);
  return kite;
}

// Step 1: Generate Zerodha login URL
// GET /api/zerodha/login — requires JWT auth, returns JSON loginUrl
// Mobile app opens this URL in a browser; userId is stored in OAuth state
router.get('/login', (req, res) => {
  const userId = req.userId;
  const state = generateState(userId);
  const kite = createKite();
  const base = kite.getLoginURL();
  const loginUrl = `${base}&state=${state}`;
  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.json({ loginUrl });
  }
  res.redirect(loginUrl);
});

// Step 2: Zerodha redirects back here after user logs in
// GET /api/zerodha/callback?request_token=XXXX
router.get('/callback', async (req, res) => {
  const { request_token, state } = req.query;

  const { valid, userId } = validateState(state);
  if (!valid || !userId) {
    return res.status(403).send('Invalid or expired OAuth state. Please try connecting again.');
  }
  if (!request_token) {
    return res.status(400).send('Missing request_token');
  }

  try {
    const kite = createKite();
    const session = await kite.generateSession(
      request_token,
      process.env.ZERODHA_API_SECRET
    );
    const accessToken = session.access_token;

    // Save to Supabase per-user (upsert so re-login updates existing row)
    await repos.connectedApps.saveToken(userId, 'zerodha', { accessToken });
    tokenCache.set(`${userId}:zerodha`, { token: accessToken, expiresAt: Date.now() + TOKEN_TTL });

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>✅ Zerodha Connected!</h2>
        <p>Your portfolio is now linked to Clutch.</p>
        <p>Close this tab and go back to the chat.</p>
        <script>setTimeout(() => window.close(), 3000)</script>
      </body></html>
    `);
  } catch (err) {
    logger.error('Zerodha auth error:', err.message);
    res.status(500).send(`Auth failed: ${err.message}`);
  }
});

// GET /api/zerodha/portfolio
router.get('/portfolio', async (req, res) => {
  const userId = req.userId;
  const token = await getAccessToken(userId);
  if (!token) {
    return res.status(401).json({ error: 'Zerodha not connected. Visit /api/zerodha/login first.' });
  }

  try {
    const kite = createKite(token);
    const [holdings, positions] = await Promise.all([
      kite.getHoldings(),
      kite.getPositions(),
    ]);

    let totalValue = 0;
    let totalInvested = 0;

    const formattedHoldings = holdings.map(h => {
      const currentValue = h.last_price * h.quantity;
      const investedValue = h.average_price * h.quantity;
      const pnl = currentValue - investedValue;
      totalValue += currentValue;
      totalInvested += investedValue;

      return {
        symbol: h.tradingsymbol,
        name: h.tradingsymbol,
        qty: h.quantity,
        buy_price: h.average_price,
        current_price: h.last_price,
        pnl: parseFloat(pnl.toFixed(2)),
        pnl_percent: investedValue > 0 ? parseFloat(((pnl / investedValue) * 100).toFixed(2)) : 0,
        broker: 'Zerodha',
      };
    });

    const totalPnl = totalValue - totalInvested;

    res.json({
      total_value: parseFloat(totalValue.toFixed(2)),
      total_invested: parseFloat(totalInvested.toFixed(2)),
      total_pnl: parseFloat(totalPnl.toFixed(2)),
      total_pnl_percent: totalInvested > 0 ? parseFloat(((totalPnl / totalInvested) * 100).toFixed(2)) : 0,
      holdings: formattedHoldings,
      brokers_connected: ['Zerodha'],
    });
  } catch (err) {
    logger.error('Portfolio fetch error:', err.message);
    // Token expired — clear so status returns false and user is prompted to reconnect
    if (err.error_type === 'TokenException' || err.message?.includes('token')) {
      clearTokenCache(userId);
      return res.status(401).json({ error: 'Zerodha session expired. Please reconnect.', reconnect: true });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zerodha/status
router.get('/status', async (req, res) => {
  const token = await getAccessToken(req.userId);
  res.json({ connected: !!token });
});

// Fetch holdings for a specific user — used by brokers/index.js adapter
async function fetchHoldingsForUser(userId) {
  const token = await getAccessToken(userId);
  if (!token) return [];
  const kite = createKite(token);
  const raw = await kite.getHoldings();
  return raw.map(h => ({
    symbol: h.tradingsymbol,
    name: h.tradingsymbol,
    qty: h.quantity,
    buy_price: h.average_price,
    current_price: h.last_price,
    broker: 'Zerodha',
  }));
}

module.exports = router;
module.exports.getAccessToken = getAccessToken;
module.exports.fetchHoldings = fetchHoldingsForUser;
