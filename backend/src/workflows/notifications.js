// Notification system — DeerFlow2 IM channels pattern adapted for Clutch
//
// DeerFlow2 sends outbound messages through Slack/Telegram/Feishu channels.
// Clutch stores notifications in Supabase for mobile polling.
// Future: extend to FCM push notifications when mobile device token is stored.
//
// Notification types:
//   spending_alert      — monthly spend crossed a threshold
//   portfolio_change    — significant P&L movement (>5%)
//   new_transactions    — new SMS/email transactions synced
//   health_alert        — health metrics below threshold
//   weekly_review       — weekly digest ready
//   daily_digest        — morning check-in data ready
//   workflow_error      — a background workflow failed
//   job_update          — new job email detected
//   salary_detected     — salary credit found
//   stealth_insight     — proactive cross-domain pattern insight

'use strict';

const repos  = require('../repositories');
const logger = require('../lib/logger');

// In-memory notification cache per user (last N, for fast GET)
const notificationCache = new Map(); // userId → [notification, ...]
const CACHE_MAX = 50;

// ─── Core send function ───────────────────────────────────────────────────────

async function notify(userId, type, message, data = {}, priority = 'normal') {
  const notification = {
    user_id:    userId,
    type,
    message,
    data:       JSON.stringify(data),
    priority,   // 'low' | 'normal' | 'high'
    read:       false,
    created_at: new Date().toISOString(),
  };

  // Write to Supabase
  const { error } = await repos.notifications.insert(notification);
  if (error) {
    logger.error('Failed to save notification', { type, userId, err: error.message });
    return false;
  }

  // Update in-memory cache
  const cached = notificationCache.get(userId) || [];
  notificationCache.set(userId, [notification, ...cached].slice(0, CACHE_MAX));

  logger.info('Notification sent', { userId, type, priority });
  return true;
}

// Fire-and-forget — never blocks the caller
function notifyAsync(userId, type, message, data = {}, priority = 'normal') {
  notify(userId, type, message, data, priority)
    .catch(err => logger.error('Async notification failed', { type, userId, err: err.message }));
}

// ─── Typed notification helpers ───────────────────────────────────────────────

const notifications = {
  // Artha agent: spending crossed monthly budget
  spendingAlert(userId, amount, budget, category) {
    return notify(userId, 'spending_alert',
      `You've spent ₹${amount.toLocaleString('en-IN')} this month${budget ? ` (${Math.round(amount / budget * 100)}% of ₹${budget.toLocaleString('en-IN')} budget)` : ''}.`,
      { amount, budget, category }, 'high');
  },

  // Vriddhi agent: portfolio P&L changed significantly
  portfolioChange(userId, pnlPercent, pnl, totalValue) {
    const direction = pnl >= 0 ? 'up' : 'down';
    return notify(userId, 'portfolio_change',
      `Portfolio is ${direction} ${Math.abs(pnlPercent).toFixed(1)}% — P&L: ₹${Math.abs(pnl).toLocaleString('en-IN')}.`,
      { pnlPercent, pnl, totalValue }, pnlPercent < -10 ? 'high' : 'normal');
  },

  // Artha agent: new transactions synced from SMS or email
  newTransactions(userId, count, source) {
    return notify(userId, 'new_transactions',
      `${count} new transaction${count !== 1 ? 's' : ''} synced from ${source}.`,
      { count, source }, 'low');
  },

  // Arogya agent: health metrics concern
  healthAlert(userId, metric, value, threshold) {
    return notify(userId, 'health_alert',
      `Your ${metric} (${value}) is below the recommended threshold of ${threshold}.`,
      { metric, value, threshold }, 'normal');
  },

  // Artha + multi-agent: weekly review ready
  weeklyReview(userId, weekTotal, vsLastWeek, topCategory) {
    const delta = vsLastWeek >= 0 ? `+${vsLastWeek.toFixed(0)}%` : `${vsLastWeek.toFixed(0)}%`;
    return notify(userId, 'weekly_review',
      `Weekly review ready. You spent ₹${weekTotal.toLocaleString('en-IN')} (${delta} vs last week). Top: ${topCategory}.`,
      { weekTotal, vsLastWeek, topCategory }, 'normal');
  },

  // Daily morning digest
  dailyDigest(userId, yesterdaySpend, steps, mood) {
    return notify(userId, 'daily_digest',
      `Good morning! Yesterday: ₹${yesterdaySpend.toLocaleString('en-IN')} spent, ${steps || '—'} steps${mood ? `, feeling ${mood}` : ''}.`,
      { yesterdaySpend, steps, mood }, 'low');
  },

  // Karma agent: job email detected
  jobUpdate(userId, subject, emailType) {
    return notify(userId, 'job_update',
      `New ${emailType} email: "${subject}"`,
      { subject, emailType }, 'high');
  },

  // Artha agent: salary detected
  salaryDetected(userId, amount, bank, date) {
    return notify(userId, 'salary_detected',
      `Salary credit detected: ₹${amount.toLocaleString('en-IN')} from ${bank} on ${date}.`,
      { amount, bank, date }, 'high');
  },

  // Cross-domain stealth insight (proactive — user didn't ask)
  stealthInsight(userId, insight, pattern, domains, confidence) {
    return notify(userId, 'stealth_insight',
      insight,
      { pattern, domains, confidence },
      confidence >= 0.85 ? 'high' : 'normal');
  },

  // Background workflow error (shown only in debug/settings)
  workflowError(userId, workflow, errorMessage) {
    return notify(userId, 'workflow_error',
      `Background sync encountered an issue (${workflow}). Data may be incomplete.`,
      { workflow, error: errorMessage }, 'low');
  },
};

// ─── Load / mark read ────────────────────────────────────────────────────────

async function loadNotifications(userId, limit = 20, unreadOnly = false) {
  return repos.notifications.load(userId, limit, unreadOnly);
}

async function markRead(userId, notificationIds) {
  await repos.notifications.markRead(userId, notificationIds);
  notificationCache.delete(userId);
}

async function markAllRead(userId) {
  await repos.notifications.markAllRead(userId);
  notificationCache.delete(userId);
}

async function unreadCount(userId) {
  const { count } = await repos.notifications.unreadCount(userId);
  return count;
}

module.exports = {
  notify,
  notifyAsync,
  notifications,
  loadNotifications,
  markRead,
  markAllRead,
  unreadCount,
};
