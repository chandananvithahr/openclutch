// Portfolio Sync Workflow — DeerFlow2 graph pattern
//
// Triggered by: scheduler (every 15 min market hours) or POST /api/workflows/trigger/portfolioSync
// Graph:        checkBrokers → fetchHoldings → detectChanges → store → notifyUser → __end__
//
// Detects significant P&L swings (>5%) and notifies the user (Vriddhi agent).

'use strict';

const { WorkflowGraph, END } = require('./engine');
const { notifications }      = require('./notifications');
const repos                  = require('../repositories');
const logger                 = require('../lib/logger');

// Threshold: notify only if portfolio moved >5% vs last stored snapshot
const NOTIFY_THRESHOLD_PERCENT = 5;

// ─── Node definitions ─────────────────────────────────────────────────────────

async function checkBrokers(state) {
  // Lazy require to avoid circular deps at startup
  const brokers = require('../brokers');
  const connected = brokers.getConnectedBrokerNames();

  if (!connected.length) {
    return { skipped: true, skipReason: 'No brokers connected' };
  }

  return { connectedBrokers: connected };
}

async function fetchHoldings(state) {
  if (state.skipped) return {};

  const brokers = require('../brokers');
  const portfolio = await brokers.getPortfolio(state.userId);

  const holdings  = portfolio?.holdings  || [];
  const totalValue    = holdings.reduce((s, h) => s + (h.current_value   || 0), 0);
  const totalInvested = holdings.reduce((s, h) => s + (h.invested_value  || 0), 0);
  const pnl           = totalValue - totalInvested;
  const pnlPercent    = totalInvested > 0
    ? parseFloat(((pnl / totalInvested) * 100).toFixed(2))
    : 0;

  logger.info('portfolioSync:fetchHoldings', {
    holdings: holdings.length, totalValue, pnl, pnlPercent, userId: state.userId,
  });

  return { holdings, totalValue, totalInvested, pnl, pnlPercent };
}

async function detectChanges(state) {
  if (state.skipped) return { significantChange: false };

  const { userId, pnlPercent, totalValue, pnl } = state;

  // Load last snapshot from connected_apps table (stored as arbitrary JSON meta)
  const { data: lastSnapshot } = await repos.connectedApps.loadMeta(userId, 'portfolio_snapshot');

  let significantChange = false;
  let changeDelta       = 0;

  if (lastSnapshot) {
    changeDelta = Math.abs(pnlPercent - (lastSnapshot.pnlPercent || 0));
    significantChange = changeDelta >= NOTIFY_THRESHOLD_PERCENT;
  }

  // Always store updated snapshot
  await repos.connectedApps.saveMeta(userId, 'portfolio_snapshot', {
    totalValue, pnl, pnlPercent, recordedAt: new Date().toISOString(),
  });

  return { significantChange, changeDelta };
}

async function storeSnapshot(state) {
  // Snapshot is already persisted in detectChanges — this node is a no-op placeholder
  // so the graph stays clean and extensible (e.g., future: write to time-series table).
  return { snapshotStored: true };
}

async function notifyUser(state) {
  const { userId, significantChange, pnlPercent, pnl, totalValue } = state;

  if (significantChange) {
    await notifications.portfolioChange(userId, pnlPercent, pnl, totalValue);
  }

  return { notified: !!significantChange };
}

// ─── Graph factory ────────────────────────────────────────────────────────────

function createPortfolioSyncWorkflow() {
  return new WorkflowGraph('portfolioSync')
    .addNode('checkBrokers',   checkBrokers)
    .addNode('fetchHoldings',  fetchHoldings)
    .addNode('detectChanges',  detectChanges)
    .addNode('storeSnapshot',  storeSnapshot)
    .addNode('notifyUser',     notifyUser)
    .addConditionalEdge('checkBrokers', s => s.skipped ? END : 'fetchHoldings')
    .addEdge('fetchHoldings',  'detectChanges')
    .addEdge('detectChanges',  'storeSnapshot')
    .addEdge('storeSnapshot',  'notifyUser')
    .addEdge('notifyUser',     END)
    .setEntry('checkBrokers');
}

module.exports = createPortfolioSyncWorkflow;
