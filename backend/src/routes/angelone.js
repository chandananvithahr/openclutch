const express = require('express');
const router = express.Router();
const SmartAPI = require('smartapi-javascript');
const supabase = require('../lib/supabase');
const logger = require('../lib/logger');

// In-memory token (loaded from Supabase on startup)
let jwtToken = null;
let smartApi = null;

function createSmartApi() {
  return new SmartAPI({ api_key: process.env.ANGEL_ONE_API_KEY });
}

// Load token from Supabase on startup
async function loadTokenFromDB() {
  const { data } = await supabase
    .from('connected_apps')
    .select('access_token')
    .eq('user_id', 'default_user')
    .eq('app_name', 'angel_one')
    .single();

  if (data?.access_token) {
    jwtToken = data.access_token;
    smartApi = createSmartApi();
    smartApi.setAccessToken(jwtToken);
    logger.info('Angel One token loaded from Supabase');
  }
}

loadTokenFromDB().catch(err => logger.error('Angel One token load failed', { err: err.message }));

// POST /api/angelone/connect
// Body: { clientId, password, totp }
// User enters these once from the mobile app
router.post('/connect', async (req, res) => {
  const { clientId, password, totp } = req.body;

  if (!clientId || !password || !totp) {
    return res.status(400).json({ error: 'clientId, password, and totp are required' });
  }

  try {
    smartApi = createSmartApi();
    const session = await smartApi.generateSession(clientId, password, totp);

    if (!session.data?.jwtToken) {
      return res.status(401).json({ error: 'Angel One login failed. Check your credentials.' });
    }

    jwtToken = session.data.jwtToken;
    smartApi.setAccessToken(jwtToken);

    // Save to Supabase
    await supabase
      .from('connected_apps')
      .upsert({
        user_id: 'default_user',
        app_name: 'angel_one',
        access_token: jwtToken,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,app_name' });

    res.json({ success: true, message: 'Angel One connected!' });
  } catch (err) {
    logger.error('Angel One connect error:', err.message);
    res.status(500).json({ error: `Connection failed: ${err.message}` });
  }
});

// GET /api/angelone/portfolio
router.get('/portfolio', async (req, res) => {
  if (!jwtToken) {
    return res.status(401).json({ error: 'Angel One not connected.' });
  }

  try {
    const holdingRes = await smartApi.getHolding();

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
      jwtToken = null;
      smartApi = null;
      return res.status(401).json({ error: 'Angel One session expired. Please reconnect.', reconnect: true });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/angelone/status
router.get('/status', (req, res) => {
  res.json({ connected: !!jwtToken });
});

function getJwtToken() { return jwtToken; }
function getSmartApi() { return smartApi; }

module.exports = router;
module.exports.getJwtToken = getJwtToken;
module.exports.getSmartApi = getSmartApi;
