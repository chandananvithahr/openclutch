const express = require('express');
const router = express.Router();
const { SmartAPI } = require('smartapi-javascript');
const repos = require('../repositories');
const logger = require('../lib/logger');

const { BoundedMap } = require('../lib/bounded-map');
// Per-user token cache
const tokenCache = new BoundedMap(10_000);
const TOKEN_TTL = 30 * 60 * 1000;

function createSmartApi(token) {
  const api = new SmartAPI({ api_key: process.env.ANGEL_ONE_API_KEY });
  if (token) api.setAccessToken(token);
  return api;
}

async function getJwtToken(userId) {
  if (!userId) return null;
  const key = `${userId}:angel_one`;
  const cached = tokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const { data } = await repos.connectedApps.loadToken(userId, 'angel_one');
  if (data?.access_token) {
    tokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + TOKEN_TTL });
    return data.access_token;
  }
  return null;
}

function clearTokenCache(userId) {
  tokenCache.delete(`${userId}:angel_one`);
}

// POST /api/angelone/connect
// Body: { clientId, password, totp }
// User enters these once from the mobile app
router.post('/connect', async (req, res) => {
  const userId = req.userId;
  const { clientId, password, totp } = req.body;

  if (!clientId || !password || !totp) {
    return res.status(400).json({ error: 'clientId, password, and totp are required' });
  }

  try {
    const api = createSmartApi();
    const session = await Promise.race([
      api.generateSession(clientId, password, totp),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Angel One API timeout — check ANGEL_ONE_API_KEY in Railway env vars')), 15000)),
    ]);

    if (!session.data?.jwtToken) {
      return res.status(401).json({ error: 'Angel One login failed. Check your credentials.' });
    }

    const token = session.data.jwtToken;

    // Save to Supabase per-user
    await repos.connectedApps.saveToken(userId, 'angel_one', { accessToken: token });
    tokenCache.set(`${userId}:angel_one`, { token, expiresAt: Date.now() + TOKEN_TTL });

    res.json({ success: true, message: 'Angel One connected!' });
  } catch (err) {
    logger.error('Angel One connect error:', err.message);
    res.status(500).json({ error: `Connection failed: ${err.message}` });
  }
});

// GET /api/angelone/portfolio
router.get('/portfolio', async (req, res) => {
  const userId = req.userId;
  const token = await getJwtToken(userId);
  if (!token) {
    return res.status(401).json({ error: 'Angel One not connected.' });
  }

  try {
    const api = createSmartApi(token);
    const holdingRes = await api.getHolding();

    if (!holdingRes.data) {
      return res.status(500).json({ error: 'Failed to fetch Angel One holdings.' });
    }

    let totalValue = 0;
    let totalInvested = 0;

    const formattedHoldings = holdingRes.data.map(h => {
      const currentValue = h.ltp * h.quantity;
      const investedValue = h.averageprice * h.quantity;
      const pnl = currentValue - investedValue;
      totalValue += currentValue;
      totalInvested += investedValue;

      return {
        symbol: h.tradingsymbol,
        name: h.symbolname || h.tradingsymbol,
        qty: h.quantity,
        buy_price: parseFloat(h.averageprice.toFixed(2)),
        current_price: parseFloat(h.ltp.toFixed(2)),
        pnl: parseFloat(pnl.toFixed(2)),
        pnl_percent: investedValue > 0 ? parseFloat(((pnl / investedValue) * 100).toFixed(2)) : 0,
        broker: 'Angel One',
      };
    });

    const totalPnl = totalValue - totalInvested;

    res.json({
      total_value: parseFloat(totalValue.toFixed(2)),
      total_invested: parseFloat(totalInvested.toFixed(2)),
      total_pnl: parseFloat(totalPnl.toFixed(2)),
      total_pnl_percent: totalInvested > 0 ? parseFloat(((totalPnl / totalInvested) * 100).toFixed(2)) : 0,
      holdings: formattedHoldings,
      brokers_connected: ['Angel One'],
    });
  } catch (err) {
    logger.error('Angel One portfolio error:', err.message);
    // Token expired — clear so status returns false and user is prompted to reconnect
    if (err.message?.includes('Invalid Token') || err.message?.includes('Unauthorized')) {
      clearTokenCache(userId);
      return res.status(401).json({ error: 'Angel One session expired. Please reconnect.', reconnect: true });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/angelone/status
router.get('/status', async (req, res) => {
  const token = await getJwtToken(req.userId);
  res.json({ connected: !!token });
});

// Fetch holdings for a specific user — used by brokers/index.js adapter
async function fetchHoldingsForUser(userId) {
  const token = await getJwtToken(userId);
  if (!token) return [];
  const api = createSmartApi(token);
  const holdingRes = await api.getHolding();
  return (holdingRes.data || []).map(h => ({
    symbol: h.tradingsymbol,
    name: h.symbolname || h.tradingsymbol,
    qty: h.quantity,
    buy_price: parseFloat(h.averageprice.toFixed(2)),
    current_price: parseFloat(h.ltp.toFixed(2)),
    broker: 'Angel One',
  }));
}

module.exports = router;
module.exports.getJwtToken = getJwtToken;
module.exports.fetchHoldings = fetchHoldingsForUser;
