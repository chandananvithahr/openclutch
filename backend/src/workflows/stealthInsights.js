'use strict';

// Stealth Insights — proactive cross-domain notifications
//
// Triggered by: scheduler (daily at 20:00 IST) or POST /api/workflows/trigger/stealthInsights
// Graph: detectPatterns → filterNew → notifyInsights → __end__
//
// The idea: run the pattern detection engine daily and push high-confidence
// insights as notifications. Users don't ask for these — they just appear.
// "You spent 65% more on days you slept under 6 hours this month."
//
// Only sends notifications for NEW patterns (not already notified in last 7 days).

const { WorkflowGraph, END } = require('./engine');
const { notify }             = require('./notifications');
const patterns               = require('../services/patterns');
const repos                  = require('../repositories');
const logger                 = require('../lib/logger');

// ─── Detect patterns ──────────────────────────────────────────────────────────

async function detectPatterns(state) {
  const { userId } = state;

  try {
    const result = await patterns.detectPatterns(userId, 30);
    return {
      allPatterns: result.patterns || [],
      dataAvailable: result.data_available,
    };
  } catch (err) {
    logger.warn('stealthInsights:detectPatterns failed', { userId, err: err.message });
    return { allPatterns: [], dataAvailable: {} };
  }
}

// ─── Filter: only new, high-confidence patterns ──────────────────────────────

async function filterNew(state) {
  const { userId, allPatterns } = state;

  if (!allPatterns.length) return { newPatterns: [] };

  // Load recent stealth_insight notifications to avoid repeats
  const { data: recentNotifs } = await repos.notifications.load(userId, 50, false);
  const recentInsightTypes = new Set(
    (recentNotifs || [])
      .filter(n => n.type === 'stealth_insight' && isWithinDays(n.created_at, 7))
      .map(n => n.data?.pattern)
      .filter(Boolean)
  );

  // Only keep high-confidence patterns not sent in the last 7 days
  const newPatterns = allPatterns.filter(p =>
    p.confidence >= 0.6 && !recentInsightTypes.has(p.pattern)
  );

  // Cap at 2 insights per day — don't spam
  const capped = newPatterns.slice(0, 2);

  logger.info('stealthInsights:filterNew', {
    userId,
    total: allPatterns.length,
    filtered: capped.length,
    skippedRecent: allPatterns.length - newPatterns.length,
  });

  return { newPatterns: capped };
}

function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < days * 86400000;
}

// ─── Send notifications ──────────────────────────────────────────────────────

async function notifyInsights(state) {
  const { userId, newPatterns } = state;

  if (!newPatterns?.length) {
    return { notified: 0 };
  }

  let sent = 0;
  for (const p of newPatterns) {
    const success = await notify(
      userId,
      'stealth_insight',
      p.insight,
      {
        pattern:    p.pattern,
        confidence: p.confidence,
        domains:    p.domains,
        data:       p.data,
      },
      p.confidence >= 0.85 ? 'high' : 'normal',
    );
    if (success) sent++;
  }

  logger.info('stealthInsights:notifyInsights', { userId, sent });
  return { notified: sent };
}

// ─── Graph factory ──────────────────────────────────────────────────────────

function createStealthInsightsWorkflow() {
  return new WorkflowGraph('stealthInsights')
    .addNode('detectPatterns', detectPatterns)
    .addNode('filterNew',      filterNew)
    .addNode('notifyInsights', notifyInsights)
    .addEdge('detectPatterns', 'filterNew')
    .addEdge('filterNew',      'notifyInsights')
    .addEdge('notifyInsights', END)
    .setEntry('detectPatterns');
}

module.exports = createStealthInsightsWorkflow;
