// Email Sync Workflow — DeerFlow2 graph pattern
//
// Triggered by: scheduler (every 30 min) or POST /api/sms/sync-email
// Graph:        checkConnection → searchEmails → parseTransactions → store → crossVerify → detectJobEmails → notifyUser → __end__
//
// This workflow unifies email scanning for:
//   1. Bank transaction emails (Artha agent)
//   2. Job-related emails (Karma agent)

'use strict';

const { WorkflowGraph, END }  = require('./engine');
const { categorize }          = require('../services/categorizer');
const repos                   = require('../repositories');
const { notifications }       = require('./notifications');
const logger                  = require('../lib/logger');
const config                  = require('../lib/config');

// ─── Bank email patterns (mirrors sms.js parseEmailTransaction) ───────────────

const BANK_PATTERNS = [
  { bank: 'HDFC',  regex: /INR\s+([\d,]+(?:\.\d{1,2})?)\s+(?:debited|withdrawn).*?(?:Info:|at|for)\s+([A-Za-z0-9 &._/-]{2,40}?)(?:\s*\.|,|\s+on|\s+Ref|$)/i },
  { bank: 'ICICI', regex: /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+debited.*?(?:at|Info:|to)\s+([A-Za-z0-9 &._/-]{2,40}?)(?:\.|,|\s+on|\s+Ref|$)/i },
  { bank: 'SBI',   regex: /Rs\.?([\d,]+(?:\.\d{1,2})?)\s+(?:has been\s+)?debited.*?(?:at|to|for)\s+([A-Za-z0-9 &._/-]{2,40}?)(?:\.|,|\s+on|$)/i },
  { bank: 'Axis',  regex: /INR\s+([\d,]+(?:\.\d{1,2})?)\s+debited.*?(?:at|for|to)\s+([A-Za-z0-9 &._/-]{2,40}?)(?:\.|,|\s+on|\s+Ref|$)/i },
  { bank: null,    regex: /(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has been\s+)?(?:debited|withdrawn|paid|spent).*?(?:at|to|for|Info:)\s*([A-Za-z0-9 &._/-]{2,40}?)(?:\.|,|\s+on|\s+Ref|$)/i },
];

const JOB_PATTERNS = {
  interview:   /interview|schedule|round/i,
  offer:       /offer|selected|congratul/i,
  rejection:   /reject|unfortunately|regret/i,
  shortlisted: /shortlist|next step/i,
  job_alert:   /naukri|linkedin|indeed|internshala/i,
};

function detectBankFromSender(from) {
  const f = (from || '').toLowerCase();
  if (f.includes('hdfc'))    return 'HDFC';
  if (f.includes('icici'))   return 'ICICI';
  if (f.includes('sbi'))     return 'SBI';
  if (f.includes('axis'))    return 'Axis';
  if (f.includes('kotak'))   return 'Kotak';
  if (f.includes('indusind')) return 'IndusInd';
  if (f.includes('yes'))     return 'Yes Bank';
  if (f.includes('paytm'))   return 'Paytm';
  return 'Bank';
}

function parseEmailDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  } catch { return null; }
}

function parseEmailTransaction(email) {
  const body = `${email.body || ''} ${email.subject || ''} ${email.preview || ''}`;
  const from = (email.from || '').toLowerCase();
  const date = parseEmailDate(email.date);
  if (!date) return null;
  if (/credited|refund|received|cashback/i.test(body) && !/debited/i.test(body)) return null;

  for (const { bank, regex } of BANK_PATTERNS) {
    const match = body.match(regex);
    if (match) {
      const amount   = parseFloat(match[1].replace(/,/g, ''));
      if (isNaN(amount) || amount <= 0 || amount > 500_000) continue;
      const merchant = match[2].trim().replace(/[^A-Za-z0-9 &._/-]/g, '').slice(0, 50);
      if (!merchant || merchant.length < 2) continue;
      return { amount, merchant, bank: bank || detectBankFromSender(from), type: 'debit', date };
    }
  }
  return null;
}

function detectJobEmailType(subject, from) {
  const s = (subject || '').toLowerCase();
  const f = (from || '').toLowerCase();
  if (JOB_PATTERNS.interview.test(s))   return 'interview';
  if (JOB_PATTERNS.offer.test(s))       return 'offer';
  if (JOB_PATTERNS.rejection.test(s))   return 'rejection';
  if (JOB_PATTERNS.shortlisted.test(s)) return 'shortlisted';
  if (JOB_PATTERNS.job_alert.test(f))   return 'job_alert';
  return null;
}

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

async function checkConnection(state) {
  // Lazy require to avoid circular deps at startup
  const gmail = require('../routes/gmail');
  const connected = await gmail.isConnected(state.userId);
  if (!connected) {
    return { skipped: true, skipReason: 'Gmail not connected' };
  }
  return { gmailConnected: true };
}

async function searchEmails(state) {
  if (state.skipped) return {};

  const gmail = require('../routes/gmail');
  const LOOKBACK = config.SPENDING.EMAIL_LOOKBACK_DAYS;

  const bankQuery = [
    'from:(alerts@hdfcbank.com OR net@hdfcbank.com)',
    'OR from:(alerts@icicibank.com OR customer.care@icicibank.com)',
    'OR from:(sbi.co.in)',
    'OR from:(axisbank.com)',
    'OR from:(alerts@kotak.com OR alerts@indusind.com OR alerts@yesbank.in OR alerts@paytmbank.com)',
    `newer_than:${LOOKBACK}d`,
    'subject:(debited OR transaction OR payment OR withdrawal OR spent)',
  ].join(' ');

  const jobQuery = [
    'subject:(interview OR "job opportunity" OR application OR shortlisted OR selected)',
    'OR from:(naukri.com OR linkedin.com OR indeed.com OR internshala.com OR instahyre.com)',
    'newer_than:7d',
  ].join(' ');

  const [bankResult, jobResult] = await Promise.allSettled([
    gmail.searchEmails(state.userId, bankQuery, config.SPENDING.MAX_EMAIL_BATCH),
    gmail.searchEmails(state.userId, jobQuery, config.SPENDING.MAX_JOB_EMAILS),
  ]);

  const bankEmails = bankResult.status === 'fulfilled' ? (bankResult.value?.emails || []) : [];
  const jobEmails  = jobResult.status  === 'fulfilled' ? (jobResult.value?.emails  || []) : [];

  logger.info('emailSync:searchEmails', {
    bank: bankEmails.length, jobs: jobEmails.length, userId: state.userId,
  });

  return { bankEmails, jobEmails };
}

async function parseTransactions(state) {
  if (state.skipped) return {};

  const parsed = (state.bankEmails || [])
    .map(parseEmailTransaction)
    .filter(Boolean);

  return { parsedTransactions: parsed };
}

async function storeTransactions(state) {
  if (state.skipped || !state.parsedTransactions?.length) {
    return { storeResult: { saved: 0, hashes: [] } };
  }

  const { parsedTransactions, userId } = state;

  const rows = parsedTransactions.map(t => ({
    user_id:  userId,
    amount:   t.amount,
    merchant: t.merchant,
    bank:     t.bank,
    type:     'debit',
    category: categorize(t.merchant, '', 'debit'),
    txn_date: t.date,
    source:   'email',
    txn_hash: buildTxnHash(t.amount, t.date, t.merchant),
  }));

  const { error } = await repos.transactions.upsertBatch(rows);
  if (error) throw new Error(`Transaction store failed: ${error.message}`);

  return { storeResult: { saved: rows.length, hashes: rows.map(r => r.txn_hash) } };
}

async function crossVerify(state) {
  if (state.skipped) return {};
  const { userId, storeResult } = state;
  const hashes = storeResult?.hashes || [];
  if (hashes.length > 0) {
    await repos.transactions.markCrossVerified(userId, hashes, 'sms');
  }
  return { crossVerified: hashes.length };
}

async function detectJobEmails(state) {
  if (state.skipped) return { newJobEmails: [] };

  const newJobEmails = (state.jobEmails || [])
    .map(e => ({ ...e, emailType: detectJobEmailType(e.subject, e.from) }))
    .filter(e => e.emailType !== null);

  return { newJobEmails };
}

async function notifyUser(state) {
  const { userId, storeResult, newJobEmails = [] } = state;

  if (storeResult?.saved > 0) {
    await notifications.newTransactions(userId, storeResult.saved, 'Gmail');
  }

  // Notify about high-priority job emails (interviews and offers only)
  for (const e of newJobEmails) {
    if (e.emailType === 'interview' || e.emailType === 'offer') {
      await notifications.jobUpdate(userId, e.subject, e.emailType);
    }
  }

  return { notified: true };
}

// ─── Graph factory ────────────────────────────────────────────────────────────

function createEmailSyncWorkflow() {
  return new WorkflowGraph('emailSync')
    .addNode('checkConnection',    checkConnection)
    .addNode('searchEmails',       searchEmails)
    .addNode('parseTransactions',  parseTransactions)
    .addNode('storeTransactions',  storeTransactions)
    .addNode('crossVerify',        crossVerify)
    .addNode('detectJobEmails',    detectJobEmails)
    .addNode('notifyUser',         notifyUser)
    .addConditionalEdge('checkConnection', s => s.skipped ? END : 'searchEmails')
    .addEdge('searchEmails',       'parseTransactions')
    .addEdge('parseTransactions',  'storeTransactions')
    .addEdge('storeTransactions',  'crossVerify')
    .addEdge('crossVerify',        'detectJobEmails')
    .addEdge('detectJobEmails',    'notifyUser')
    .addEdge('notifyUser',         END)
    .setEntry('checkConnection');
}

module.exports = createEmailSyncWorkflow;
