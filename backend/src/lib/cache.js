// Simple in-memory TTL cache — dns.toys pattern (background refresh + locked reads)
// Each entry: { data, expiresAt }

'use strict';

const store = new Map();

function set(key, data, ttlMs) {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

function del(key) {
  store.delete(key);
}

// Wrap an async fetcher with cache — call fn only if cache is cold or expired
async function withCache(key, ttlMs, fn) {
  const cached = get(key);
  if (cached !== null) return cached;
  const fresh = await fn();
  set(key, fresh, ttlMs);
  return fresh;
}

const TTL = {
  PORTFOLIO: 5 * 60 * 1000,     // 5 min — broker data
  STOCK_PRICE: 2 * 60 * 1000,   // 2 min — live prices
  FINANCIALS: 24 * 60 * 60 * 1000, // 24 hr — screener data
  SPENDING: 10 * 60 * 1000,     // 10 min — SMS/email transactions
};

module.exports = { get, set, del, withCache, TTL };
