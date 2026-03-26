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

    async isConnected(userId) {
      const z = require('../routes/zerodha');
      return !!(await z.getAccessToken(userId));
    },

    async getHoldings(userId) {
      const z = require('../routes/zerodha');
      const raw = await z.fetchHoldings(userId);
      return raw.map(h => normalizeHolding({
        symbol:       h.symbol,
        name:         h.name,
        qty:          h.qty,
        currentPrice: h.current_price,
        avgPrice:     h.buy_price,
        broker:       'Zerodha',
      }));
    },
  },

  {
    name: 'Angel One',

    async isConnected(userId) {
      const a = require('../routes/angelone');
      return !!(await a.getJwtToken(userId));
    },

    async getHoldings(userId) {
      const a = require('../routes/angelone');
      const raw = await a.fetchHoldings(userId);
      return raw.map(h => normalizeHolding({
        symbol:       h.symbol,
        name:         h.name,
        qty:          h.qty,
        currentPrice: h.current_price,
        avgPrice:     h.buy_price,
        broker:       'Angel One',
      }));
    },
  },

  {
    name: 'Upstox',

    async isConnected(userId) {
      const u = require('../routes/upstox');
      return !!(await u.getAccessToken(userId));
    },

    async getHoldings(userId) {
      const u = require('../routes/upstox');
      const token = await u.getAccessToken(userId);
      if (!token) return [];
      // Set SDK token before fetching
      const { ApiClient } = require('upstox-js-sdk');
      ApiClient.instance.authentications['OAUTH2'].accessToken = token;
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

    async isConnected(userId) {
      const f = require('../routes/fyers');
      return !!(await f.getAccessToken(userId));
    },

    async getHoldings(userId) {
      const f = require('../routes/fyers');
      const token = await f.getAccessToken(userId);
      if (!token) return [];
      const raw = await f.fetchHoldings(token);
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
];

// ─── Unified portfolio ────────────────────────────────────────────────────────

async function getPortfolio(userId) {
  const allHoldings = [];
  let   totalValue  = 0;
  let   totalInvested = 0;
  const connected   = [];

  for (const adapter of adapters) {
    if (!(await adapter.isConnected(userId))) continue;

    try {
      const holdings = await adapter.getHoldings(userId);
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
async function anyConnected(userId) {
  for (const a of adapters) {
    if (await a.isConnected(userId)) return true;
  }
  return false;
}

// Names of all connected brokers
async function connectedNames(userId) {
  const names = [];
  for (const a of adapters) {
    if (await a.isConnected(userId)) names.push(a.name);
  }
  return names;
}

module.exports = { getPortfolio, anyConnected, connectedNames, adapters };
