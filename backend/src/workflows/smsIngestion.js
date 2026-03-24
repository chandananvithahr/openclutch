// SMS Ingestion Workflow — DeerFlow2 graph pattern
//
// Triggered by: POST /api/sms/transactions (mobile sends SMS batch)
// Graph:        validate → categorize → store → crossVerify → notifyUser → __end__
//
// State fields:
//   input:         { transactions, userId, source }
//   validated:     cleaned transaction array
//   categorized:   transactions with category assigned
//   storeResult:   { saved, errors }
//   verified:      number of cross-verified transactions

'use strict';

const { WorkflowGraph, END }   = require('./engine');
const { categorize }           = require('../services/categorizer');
const repos                    = require('../repositories');
const { notifications }        = require('./notifications');
const logger                   = require('../lib/logger');

// ─── Build txn hash (content-based dedup — same as sms.js) ───────────────────

function buildTxnHash(amount, date, merchant) {
  const normalized = `${amount}_${date}_${merchant.toLowerCase().replace(/\s+/g, '').slice(0, 12)}`;
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = ((h << 5) - h) + normalized.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16);
}

// ─── Node definitions ─────────────────────────────────────────────────────────

async function validate(state) {
  const { transactions, userId } = state;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new Error('transactions array is empty or missing');
  }
  if (!userId) throw new Error('userId is required');

  // Filter malformed rows
  const valid = transactions.filter(t => {
    if (!t.amount || typeof t.amount !== 'number' || t.amount <= 0) return false;
    if (!t.date || typeof t.date !== 'string')                        return false;
    if (t.amount > 10_000_000) return false; // sanity cap
    return true;
  });

  logger.info('smsIngestion:validate', { total: transactions.length, valid: valid.length, userId });
  return { validated: valid };
}

async function categorizeTxns(state) {
  const categorized = state.validated.map(t => ({
    ...t,
    category: t.category || categorize(t.merchant || '', t.message || '', t.type || 'debit'),
  }));
  return { categorized };
}

async function store(state) {
  const { categorized, userId, source = 'sms' } = state;

  const rows = categorized.map(t => ({
    user_id:  userId,
    amount:   t.amount,
    merchant: t.merchant || 'Unknown',
    bank:     t.bank     || null,
    type:     t.type     || 'debit',
    category: t.category,
    txn_date: t.date,
    source,
    txn_hash: t.hash || buildTxnHash(t.amount, t.date, t.merchant || 'unknown'),
  }));

  const { error } = await repos.transactions.upsertBatch(rows);
  if (error) throw new Error(`DB upsert failed: ${error.message}`);

  return { storeResult: { saved: rows.length, hashes: rows.map(r => r.txn_hash) } };
}

async function crossVerify(state) {
  const { userId, source = 'sms', storeResult } = state;
  const hashes     = storeResult.hashes || [];
  const crossSource = source === 'email' ? 'sms' : 'email';

  const { error } = await repos.transactions.markCrossVerified(userId, hashes, crossSource);
  if (error) {
    logger.warn('smsIngestion:crossVerify failed (non-fatal)', { err: error.message });
  }

  // Count how many got marked 'both'
  return { verified: hashes.length };
}

async function notifyUser(state) {
  const { userId, storeResult, source } = state;
  const count = storeResult.saved;

  if (count > 0) {
    await notifications.newTransactions(userId, count, source === 'email' ? 'Gmail' : 'SMS');
  }

  // Check if this month's spending crossed a notable milestone
  const month = new Date().toISOString().slice(0, 7);
  const spending = await repos.transactions.querySpending(userId, {
    type: 'debit',
    startDate: `${month}-01`,
  });
  const monthTotal = (spending.data || []).reduce((s, t) => s + t.amount, 0);

  if (monthTotal >= 50000 && count > 0) {
    await notifications.spendingAlert(userId, monthTotal, null, null);
  }

  return { notified: true };
}

// ─── Graph factory ────────────────────────────────────────────────────────────

function createSmsIngestionWorkflow() {
  return new WorkflowGraph('smsIngestion')
    .addNode('validate',      validate)
    .addNode('categorize',    categorizeTxns)
    .addNode('store',         store)
    .addNode('crossVerify',   crossVerify)
    .addNode('notifyUser',    notifyUser)
    .addEdge('validate',      'categorize')
    .addEdge('categorize',    'store')
    .addEdge('store',         'crossVerify')
    .addEdge('crossVerify',   'notifyUser')
    .addEdge('notifyUser',    END)
    .setEntry('validate');
}

module.exports = createSmsIngestionWorkflow;
