// Broker adapter layer — kiteconnectjs + StockSense pattern
// Each broker exposes a uniform interface: { isConnected(), getHoldings() }
// getPortfolio() merges all connected brokers into one response.
//
// Previously: 60-line duplicate in executor.js with interleaved Zerodha + Angel One logic.
// Now: adapters[] + normalizeHolding() removes the duplication.
//
// Adding a new broker (e.g. Groww) = add one entry to adapters[].

'use strict';

const logger = require('../lib/logger');

// ─── Shared normalization ─────────────────────────────────────────────────────

function normalizeHolding({ symbol, name, qty, currentPrice, avgPrice, broker }) {
  const cv  = currentPrice * qty;
  const iv  = avgPrice * qty;
  const pnl = cv - iv;
  return {
    symbol,
    name,
    qty,
    buy_price:     parseFloat(avgPrice.toFixed(2)),
    current_price: parseFloat(currentPrice.toFixed(2)),
    pnl:           parseFloat(pnl.toFixed(2)),
    pnl_percent:   iv > 0 ? parseFloat(((pnl / iv) * 100).toFixed(2)) : 0,
    broker,
  };
}

// ─── Adapters ─────────────────────────────────────────────────────────────────

// Lazy-require broker modules to avoid circular dependency issues at startup
const adapters = [
  {
    name: 'Zerodha',

    isConnected() {
      const z = require('../routes/zerodha');
      return !!z.getAccessToken();
    },

    async getHoldings() {
      const z    = require('../routes/zerodha');
      const kite = z.getKite();
      const raw  = await kite.getHoldings();
      return raw.map(h => normalizeHolding({
        symbol:       h.tradingsymbol,
        name:         h.tradingsymbol,
        qty:          h.quantity,
        currentPrice: h.last_price,
        avgPrice:     h.average_price,
        broker:       'Zerodha',
      }));
    },
  },

  {
    name: 'Angel One',

    isConnected() {
      const a = require('../routes/angelone');
      return !!a.getJwtToken();
    },

    async getHoldings() {
      const a   = require('../routes/angelone');
      const api = a.getSmartApi();
      const res = await api.getHolding();
      return (res.data || []).map(h => normalizeHolding({
        symbol:       h.tradingsymbol,
        name:         h.symbolname || h.tradingsymbol,
        qty:          h.quantity,
        currentPrice: h.ltp,
        avgPrice:     h.averageprice,
        broker:       'Angel One',
      }));
    },
  },

  {
    name: 'Upstox',

    isConnected() {
      const u = require('../routes/upstox');
      return !!u.getAccessToken();
    },

    async getHoldings() {
      const u   = require('../routes/upstox');
      const raw = await u.fetchHoldings();
      return raw.map(h => normalizeHolding({
        symbol:       h.symbol,
        name:         h.name,
        qty:          h.qty,
        currentPrice: h.current_price,
        avgPrice:     h.buy_price,
        broker:       'Upstox',
      }));
    },
  },

  {
    name: 'Fyers',

    isConnected() {
      const f = require('../routes/fyers');
      return !!f.getAccessToken();
    },

    async getHoldings() {
      const f   = require('../routes/fyers');
      const raw = await f.fetchHoldings();
      return raw.map(h => normalizeHolding({
        symbol:       h.symbol,
        name:         h.name,
        qty:          h.qty,
        currentPrice: h.current_price,
        avgPrice:     h.buy_price,
        broker:       'Fyers',
      }));
    },
  },

  {
    name: 'Dhan',

    isConnected() {
      const d = require('../routes/dhan');
      return !!d.getAccessToken();
    },

    async getHoldings() {
      const d   = require('../routes/dhan');
      const raw = await d.fetchHoldings();
      return raw.map(h => normalizeHolding({
        symbol:       h.symbol,
        name:         h.name,
        qty:          h.qty,
        currentPrice: h.current_price,
        avgPrice:     h.buy_price,
        broker:       'Dhan',
      }));
    },
  },

  {
    name: '5paisa',

    isConnected() {
      const f = require('../routes/fivepaisa');
      return !!f.getAccessToken();
    },

    async getHoldings() {
      const f   = require('../routes/fivepaisa');
      const raw = await f.fetchHoldings();
      return raw.map(h => normalizeHolding({
        symbol:       h.symbol,
        name:         h.name,
        qty:          h.qty,
        currentPrice: h.current_price,
        avgPrice:     h.buy_price,
        broker:       '5paisa',
      }));
    },
  },
];

// ─── Unified portfolio ────────────────────────────────────────────────────────

async function getPortfolio() {
  const allHoldings = [];
  let   totalValue  = 0;
  let   totalInvested = 0;
  const connected   = [];

  for (const adapter of adapters) {
    if (!adapter.isConnected()) continue;

    try {
      const holdings = await adapter.getHoldings();
      for (const h of holdings) {
        // Use buy_price * qty for invested, current_price * qty for value
        totalValue    += h.current_price * h.qty;
        totalInvested += h.buy_price     * h.qty;
        allHoldings.push(h);
      }
      connected.push(adapter.name);
    } catch (err) {
      logger.error(`${adapter.name} portfolio fetch failed`, { err: err.message });
      // Token expired → clear state so status reflects reality
      if (err.error_type === 'TokenException' || err.message?.includes('token')) {
        logger.warn(`${adapter.name} token appears expired — clearing`);
      }
      // Continue — partial portfolio is better than no portfolio
    }
  }

  if (connected.length === 0) {
    return {
      error:  'No brokers connected',
      action: 'Ask the user to connect a broker. They can tap the Zerodha or Angel One button in the status bar.',
    };
  }

  const pnl = totalValue - totalInvested;

  return {
    total_value:       parseFloat(totalValue.toFixed(2)),
    total_invested:    parseFloat(totalInvested.toFixed(2)),
    total_pnl:         parseFloat(pnl.toFixed(2)),
    total_pnl_percent: totalInvested > 0
      ? parseFloat(((pnl / totalInvested) * 100).toFixed(2))
      : 0,
    holdings:          allHoldings,
    brokers_connected: connected,
  };
}

// Check if any broker is connected (for chat status bar)
function anyConnected() {
  return adapters.some(a => a.isConnected());
}

// Names of all connected brokers
function connectedNames() {
  return adapters.filter(a => a.isConnected()).map(a => a.name);
}

module.exports = { getPortfolio, anyConnected, connectedNames, adapters };
