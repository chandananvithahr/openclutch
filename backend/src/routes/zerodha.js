const express = require('express');
const router = express.Router();
const { KiteConnect } = require('kiteconnect');
const supabase = require('../lib/supabase');

const kite = new KiteConnect({
  api_key: process.env.ZERODHA_API_KEY,
});

// Load token from Supabase on startup so it survives server restarts
let accessToken = null;

async function loadTokenFromDB() {
  const { data } = await supabase
    .from('connected_apps')
    .select('access_token')
    .eq('user_id', 'default_user')
    .eq('app_name', 'zerodha')
    .single();

  if (data?.access_token) {
    accessToken = data.access_token;
    kite.setAccessToken(accessToken);
    console.log('Zerodha token loaded from Supabase');
  }
}

loadTokenFromDB().catch(console.error);

// Step 1: Generate Zerodha login URL
// GET /api/zerodha/login — returns JSON for app, redirects for browser
router.get('/login', (req, res) => {
  const loginUrl = kite.getLoginURL();
  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.json({ loginUrl });
  }
  res.redirect(loginUrl);
});

// Step 2: Zerodha redirects back here after user logs in
// GET /api/zerodha/callback?request_token=XXXX
router.get('/callback', async (req, res) => {
  const { request_token } = req.query;

  if (!request_token) {
    return res.status(400).send('Missing request_token');
  }

  try {
    const session = await kite.generateSession(
      request_token,
      process.env.ZERODHA_API_SECRET
    );
    accessToken = session.access_token;
    kite.setAccessToken(accessToken);

    // Save to Supabase (upsert so re-login updates existing row)
    await supabase
      .from('connected_apps')
      .upsert({
        user_id: 'default_user',
        app_name: 'zerodha',
        access_token: accessToken,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,app_name' });

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>✅ Zerodha Connected!</h2>
        <p>Your portfolio is now linked to Clutch.</p>
        <p>Close this tab and go back to the chat.</p>
        <script>setTimeout(() => window.close(), 3000)</script>
      </body></html>
    `);
  } catch (err) {
    console.error('Zerodha auth error:', err.message);
    res.status(500).send(`Auth failed: ${err.message}`);
  }
});

// GET /api/zerodha/portfolio
router.get('/portfolio', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: 'Zerodha not connected. Visit /api/zerodha/login first.' });
  }

  try {
    kite.setAccessToken(accessToken);
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
    console.error('Portfolio fetch error:', err.message);
    // Token expired — clear so status returns false and user is prompted to reconnect
    if (err.error_type === 'TokenException' || err.message?.includes('token')) {
      accessToken = null;
      return res.status(401).json({ error: 'Zerodha session expired. Please reconnect.', reconnect: true });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zerodha/status
router.get('/status', (req, res) => {
  res.json({ connected: !!accessToken });
});

function getAccessToken() { return accessToken; }
function getKite() { return kite; }

module.exports = router;
module.exports.getKite = getKite;
module.exports.getAccessToken = getAccessToken;
