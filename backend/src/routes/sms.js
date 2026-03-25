// SMS + Email Expense Tracker — Artha Agent
// Receives parsed transactions from SMS (mobile) and Gmail (backend)
// Both sources use the same dedup hash: hash(amount + date + normalizedMerchant)
// Same transaction from both sources → updates source to 'both', never double-counts

const express = require('express');
const router = express.Router();
const repos = require('../repositories');
const { categorize } = require('../services/categorizer');
const logger = require('../lib/logger');
const config = require('../lib/config');

// POST /api/sms/transactions
// Mobile sends batch of parsed bank SMS transactions
router.post('/transactions', async (req, res) => {
  const { transactions } = req.body;
  const userId = req.userId;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: 'transactions array required' });
  }

  // Validate individual transactions
  const valid = transactions.filter(t => {
    if (!t.amount || typeof t.amount !== 'number' || t.amount <= 0) return false;
    if (t.amount > config.SPENDING.MAX_TXN_AMOUNT) return false;
    if (!t.date) return false;
    return true;
  });

  if (valid.length === 0) {
    return res.status(400).json({ error: 'No valid transactions in batch' });
  }

  const result = await upsertTransactions(valid, userId, 'sms');
  res.json(result);
});

// POST /api/sms/sync-email — triggered automatically when Gmail is connected
router.post('/sync-email', async (req, res) => {
  const userId = req.userId;
  const result = await syncEmailTransactions(userId);
  res.json(result);
});

// GET /api/sms/spending?userId=&month=2026-03
router.get('/spending', async (req, res) => {
  const userId = req.userId;
  const { month } = req.query;
  const summary = await getSpendingData(userId, month);
  res.json(summary);
});

// GET /api/sms/recent — shows last 20 stored transactions (for debugging)
router.get('/recent', async (req, res) => {
  const userId = req.userId;
  const { data, error } = await repos.transactions.loadRecent(userId, config.SPENDING.RECENT_TXNS_LIMIT);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ transactions: data, count: data.length });
});

// GET /api/sms/status
router.get('/status', async (req, res) => {
  const userId = req.userId;
  const { count, error } = await repos.transactions.count(userId);

  res.json({ connected: !error && count > 0, transaction_count: count });
});

// --- Core dedup logic ---
// Hash is based on content, NOT the raw message body
// So SMS and email about the same transaction produce the same hash → no double-count
// Uses FNV-1a dual 32-bit for collision resistance (portable — matches mobile/smsParser.js)
function buildTxnHash(amount, date, merchant) {
  const normalized = `${amount}_${date}_${(merchant || '').toLowerCase().replace(/\s+/g, '').slice(0, 12)}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized.charCodeAt(i);
    h1 ^= c; h1 = Math.imul(h1, 0x01000193);
    h2 ^= c; h2 = Math.imul(h2, 0x811c9dc5);
  }
  return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0'));
}

async function upsertTransactions(transactions, userId, source) {
  const rows = transactions.map(t => ({
    user_id: userId,
    amount: t.amount,
    merchant: t.merchant || 'Unknown',
    bank: t.bank,
    type: t.type || 'debit',
    category: t.category || categorize(t.merchant || '', t.message || '', t.type || 'debit'),
    txn_date: t.date,
    source,
    txn_hash: t.hash || buildTxnHash(t.amount, t.date, t.merchant || 'unknown'),
  }));

  // Insert new transactions via repository (dedup by user_id + txn_hash)
  const { error } = await repos.transactions.upsertBatch(rows);

  if (error) {
    logger.error('Transaction insert error', { err: error.message });
    return { error: error.message };
  }

  // Mark cross-verified transactions via repository
  const crossSource = source === 'email' ? 'sms' : 'email';
  const hashes = rows.map(r => r.txn_hash);
  if (hashes.length > 0) {
    await repos.transactions.markCrossVerified(userId, hashes, crossSource);
  }

  return { success: true, saved: rows.length };
}

// --- Gmail email transaction sync ---
async function syncEmailTransactions(userId) {
  let gmail;
  try {
    gmail = require('./gmail');
  } catch {
    return { error: 'Gmail module not available' };
  }

  const gmailConnected = await gmail.isConnected(userId);
  if (!gmailConnected) {
    return { skipped: true, reason: 'Gmail not connected' };
  }

  // Search for bank transaction alert emails from last 60 days
  const bankEmailQuery = config.BANK_EMAIL_QUERY;

  let emailData;
  try {
    emailData = await gmail.searchEmails(userId, bankEmailQuery, 100);
  } catch (err) {
    return { error: `Gmail search failed: ${err.message}` };
  }

  if (!emailData?.emails?.length) {
    return { synced: 0, message: 'No bank transaction emails found' };
  }

  const parsed = emailData.emails
    .map(email => parseEmailTransaction(email))
    .filter(Boolean);

  if (parsed.length === 0) {
    return { synced: 0, message: 'Bank emails found but no debit transactions could be parsed' };
  }

  return await upsertTransactions(parsed, userId, 'email');
}

// Parse a bank email into a transaction object — mirrors SMS parser patterns
function parseEmailTransaction(email) {
  const body = ((email.body || '') + ' ' + (email.subject || '') + ' ' + (email.preview || ''));
  const from = (email.from || '').toLowerCase();
  const date = parseEmailDate(email.date);

  if (!date) return null;

  // Skip credit emails
  if (/credited|refund|received|cashback/i.test(body) && !/debited/i.test(body)) return null;

  const PATTERNS = [
    // HDFC: "INR 2,450 debited from A/C"
    { bank: 'HDFC', regex: /INR\s+([\d,]+(?:\.\d{1,2})?)\s+(?:debited|withdrawn).*?(?:Info:|at|for)\s+([A-Za-z0-9 &._/-]{2,40}?)(?:\s*\.|,|\s+on|\s+Ref|$)/i },
    // ICICI: "Rs 1000.00 debited"
    { bank: 'ICICI', regex: /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+debited.*?(?:at|Info:|to)\s+([A-Za-z0-9 &._/-]{2,40}?)(?:\.|,|\s+on|\s+Ref|$)/i },
    // SBI: "Rs.500.00 debited"
    { bank: 'SBI', regex: /Rs\.?([\d,]+(?:\.\d{1,2})?)\s+(?:has been\s+)?debited.*?(?:at|to|for)\s+([A-Za-z0-9 &._/-]{2,40}?)(?:\.|,|\s+on|$)/i },
    // Axis: "INR 350 debited"
    { bank: 'Axis', regex: /INR\s+([\d,]+(?:\.\d{1,2})?)\s+debited.*?(?:at|for|to)\s+([A-Za-z0-9 &._/-]{2,40}?)(?:\.|,|\s+on|\s+Ref|$)/i },
    // Generic: amount + debit + merchant
    { bank: detectBankFromEmail(from), regex: /(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has been\s+)?(?:debited|withdrawn|paid|spent).*?(?:at|to|for|Info:)\s*([A-Za-z0-9 &._/-]{2,40}?)(?:\.|,|\s+on|\s+Ref|$)/i },
  ];

  for (const { bank, regex } of PATTERNS) {
    const match = body.match(regex);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (isNaN(amount) || amount <= 0 || amount > 500000) continue;

      const merchant = match[2].trim().replace(/[^A-Za-z0-9 &._/-]/g, '').slice(0, 50);
      if (!merchant || merchant.length < 2) continue;

      return {
        amount,
        merchant,
        bank: bank || detectBankFromEmail(from),
        type: 'debit',
        date,
      };
    }
  }

  return null;
}

function parseEmailDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function detectBankFromEmail(from) {
  if (from.includes('hdfc')) return 'HDFC';
  if (from.includes('icici')) return 'ICICI';
  if (from.includes('sbi')) return 'SBI';
  if (from.includes('axis')) return 'Axis';
  if (from.includes('kotak')) return 'Kotak';
  if (from.includes('indusind')) return 'IndusInd';
  if (from.includes('yes')) return 'Yes Bank';
  if (from.includes('paytm')) return 'Paytm';
  return 'Bank';
}

// --- Spending summary ---
async function getSpendingData(userId, month) {
  let startDate;
  let endDate;

  if (month) {
    const [yr, mo] = month.split('-').map(Number);
    startDate = `${month}-01`;
    endDate = mo === 12 ? `${yr + 1}-01-01` : `${yr}-${String(mo + 1).padStart(2, '0')}-01`;
  }

  const { data, error } = await repos.transactions.querySpending(userId, {
    type: 'debit', startDate, endDate,
  });
  if (error) return { error: error.message };

  return buildSpendingSummary(data);
}

function buildSpendingSummary(transactions) {
  if (!transactions.length) {
    return { total: 0, by_category: {}, top_merchants: [], transaction_count: 0, verified_by_both: 0 };
  }

  const byCategory = {};
  const byMerchant = {};
  let total = 0;
  let verifiedCount = 0;

  for (const t of transactions) {
    total += t.amount;
    if (t.source === 'both') verifiedCount++;
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    byMerchant[t.merchant] = (byMerchant[t.merchant] || 0) + t.amount;
  }

  const topMerchants = Object.entries(byMerchant)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([merchant, amount]) => ({ merchant, amount: parseFloat(amount.toFixed(2)) }));

  const categoryFormatted = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [cat, amt]) => {
      acc[cat] = {
        amount: parseFloat(amt.toFixed(2)),
        percent: parseFloat(((amt / total) * 100).toFixed(1)),
      };
      return acc;
    }, {});

  return {
    total: parseFloat(total.toFixed(2)),
    transaction_count: transactions.length,
    verified_by_both: verifiedCount, // transactions confirmed by SMS + email
    by_category: categoryFormatted,
    top_merchants: topMerchants,
  };
}


module.exports = router;
module.exports.getSpending = getSpendingData;
module.exports.syncEmailTransactions = syncEmailTransactions;
module.exports.buildTxnHash = buildTxnHash;
module.exports.upsertTransactions = upsertTransactions;
