// Weekly Review Workflow — DeerFlow2 graph pattern
//
// Triggered by: scheduler (every Sunday 09:00) or POST /api/workflows/trigger/weeklyReview
// Graph:        gatherSpending → gatherHealth → gatherCareer → compose → store → notifyUser → __end__
//
// Artha + multi-agent digest: spending vs last week, health summary, job activity, top category.

'use strict';

const { WorkflowGraph, END } = require('./engine');
const { notifications }      = require('./notifications');
const repos                  = require('../repositories');
const logger                 = require('../lib/logger');

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getWeekRange(weeksAgo = 0) {
  const now   = new Date();
  const day   = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - day - 7 * weeksAgo + (day === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday.toISOString().slice(0, 10),
    end:   sunday.toISOString().slice(0, 10),
  };
}

// ─── Node definitions ─────────────────────────────────────────────────────────

async function gatherSpending(state) {
  const { userId } = state;

  const thisWeek = getWeekRange(0);
  const lastWeek = getWeekRange(1);

  const [thisResult, lastResult] = await Promise.allSettled([
    repos.transactions.querySpending(userId, { type: 'debit', startDate: thisWeek.start, endDate: thisWeek.end }),
    repos.transactions.querySpending(userId, { type: 'debit', startDate: lastWeek.start, endDate: lastWeek.end }),
  ]);

  const thisData  = thisResult.status  === 'fulfilled' ? (thisResult.value?.data  || []) : [];
  const lastData  = lastResult.status  === 'fulfilled' ? (lastResult.value?.data  || []) : [];

  const thisTotal = thisData.reduce((s, t) => s + t.amount, 0);
  const lastTotal = lastData.reduce((s, t) => s + t.amount, 0);
  const vsLastWeek = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;

  // Top category by spend
  const catMap = {};
  for (const t of thisData) {
    catMap[t.category || 'others'] = (catMap[t.category || 'others'] || 0) + t.amount;
  }
  const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'others';

  logger.info('weeklyReview:gatherSpending', { userId, thisTotal, lastTotal, topCategory });

  return { thisWeekSpend: thisTotal, lastWeekSpend: lastTotal, vsLastWeek, topCategory };
}

async function gatherHealth(state) {
  const { userId } = state;

  const thisWeek = getWeekRange(0);

  const { data, error } = await repos.healthData.queryRange(userId, thisWeek.start, thisWeek.end);
  if (error || !data?.length) {
    return { avgSteps: 0, avgSleep: 0 };
  }

  const avgSteps = Math.round(data.reduce((s, d) => s + (d.steps || 0), 0) / data.length);
  const avgSleep = parseFloat((data.reduce((s, d) => s + (d.sleep_hours || 0), 0) / data.length).toFixed(1));

  return { avgSteps, avgSleep };
}

async function gatherCareer(state) {
  const { userId } = state;

  // Count job emails in the last 7 days (from jobEmails stored in workflow state or DB)
  // Since we don't persist job emails, we return a lightweight placeholder.
  // Future: query job_applications table for new activity.
  return { newJobActivity: 0 };
}

async function compose(state) {
  const { thisWeekSpend, vsLastWeek, topCategory, avgSteps, avgSleep } = state;

  const summary = {
    weekTotal:   thisWeekSpend,
    vsLastWeek,
    topCategory,
    avgSteps,
    avgSleep,
    composedAt:  new Date().toISOString(),
  };

  logger.info('weeklyReview:compose', { userId: state.userId, summary });

  return { weeklySummary: summary };
}

async function storeReview(state) {
  // Store in notifications table as a weekly_review record via notify()
  // The notifyUser node will handle this — storeReview is a no-op placeholder
  // reserved for future: write to weekly_reviews table for history.
  return { reviewStored: true };
}

async function notifyUser(state) {
  const { userId, weeklySummary } = state;
  if (!weeklySummary) return { notified: false };

  await notifications.weeklyReview(
    userId,
    weeklySummary.weekTotal,
    weeklySummary.vsLastWeek,
    weeklySummary.topCategory,
  );

  return { notified: true };
}

// ─── Graph factory ────────────────────────────────────────────────────────────

function createWeeklyReviewWorkflow() {
  return new WorkflowGraph('weeklyReview')
    .addNode('gatherSpending', gatherSpending)
    .addNode('gatherHealth',   gatherHealth)
    .addNode('gatherCareer',   gatherCareer)
    .addNode('compose',        compose)
    .addNode('storeReview',    storeReview)
    .addNode('notifyUser',     notifyUser)
    // Note: gatherHealth and gatherCareer could run in parallel with gatherSpending
    // but WorkflowGraph is sequential by design (linear graph). Parallel gather
    // would require fan-out nodes — acceptable future enhancement.
    .addEdge('gatherSpending', 'gatherHealth')
    .addEdge('gatherHealth',   'gatherCareer')
    .addEdge('gatherCareer',   'compose')
    .addEdge('compose',        'storeReview')
    .addEdge('storeReview',    'notifyUser')
    .addEdge('notifyUser',     END)
    .setEntry('gatherSpending');
}

module.exports = createWeeklyReviewWorkflow;
