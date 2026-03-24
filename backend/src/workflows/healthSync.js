// Health Sync Workflow — DeerFlow2 graph pattern
//
// Triggered by: POST /api/health/sync (mobile pushes Health Connect data)
//               or scheduler (daily at 07:00)
// Graph:        validate → store → analyzePatterns → notifyUser → __end__
//
// Arogya agent: persists daily steps, sleep, heart rate; triggers alerts on low metrics.

'use strict';

const { WorkflowGraph, END } = require('./engine');
const { notifications }      = require('./notifications');
const repos                  = require('../repositories');
const logger                 = require('../lib/logger');

// ─── Thresholds (Arogya agent) ────────────────────────────────────────────────

const THRESHOLDS = {
  steps:     5000,   // below = sedentary alert
  sleepHours: 6,     // below = poor sleep alert
  heartRate:  { low: 45, high: 110 },  // resting HR range
};

// ─── Node definitions ─────────────────────────────────────────────────────────

async function validate(state) {
  const { metrics, userId } = state;

  if (!userId) throw new Error('userId is required');
  if (!metrics || typeof metrics !== 'object') {
    throw new Error('metrics object is required');
  }

  // Sanitize + type-coerce fields
  const clean = {
    date:           metrics.date         || new Date().toISOString().slice(0, 10),
    steps:          parseInt(metrics.steps          || 0,  10),
    sleep_hours:    parseFloat(metrics.sleep_hours  || 0),
    heart_rate_avg: parseInt(metrics.heart_rate_avg || 0,  10),
    calories_burned: parseInt(metrics.calories_burned || 0, 10),
    active_calories: parseInt(metrics.active_calories || 0, 10),
  };

  // Basic sanity caps
  if (clean.steps > 100_000)         clean.steps = 100_000;
  if (clean.sleep_hours > 24)        clean.sleep_hours = 24;
  if (clean.heart_rate_avg > 300)    clean.heart_rate_avg = 0;

  logger.info('healthSync:validate', { userId, date: clean.date, steps: clean.steps });
  return { cleanMetrics: clean };
}

async function storeMetrics(state) {
  const { cleanMetrics, userId } = state;

  const row = {
    user_id:         userId,
    date:            cleanMetrics.date,
    steps:           cleanMetrics.steps,
    sleep_hours:     cleanMetrics.sleep_hours,
    heart_rate_avg:  cleanMetrics.heart_rate_avg,
    calories_burned: cleanMetrics.calories_burned,
    active_calories: cleanMetrics.active_calories,
    source:          state.source || 'health_connect',
  };

  const { error } = await repos.healthData.upsert(row);
  if (error) throw new Error(`Health data store failed: ${error.message}`);

  return { stored: true };
}

async function analyzePatterns(state) {
  const { cleanMetrics, userId } = state;
  const alerts = [];

  if (cleanMetrics.steps > 0 && cleanMetrics.steps < THRESHOLDS.steps) {
    alerts.push({ metric: 'steps', value: cleanMetrics.steps, threshold: THRESHOLDS.steps });
  }

  if (cleanMetrics.sleep_hours > 0 && cleanMetrics.sleep_hours < THRESHOLDS.sleepHours) {
    alerts.push({ metric: 'sleep', value: cleanMetrics.sleep_hours, threshold: THRESHOLDS.sleepHours });
  }

  const hr = cleanMetrics.heart_rate_avg;
  if (hr > 0 && (hr < THRESHOLDS.heartRate.low || hr > THRESHOLDS.heartRate.high)) {
    alerts.push({ metric: 'heart_rate', value: hr, threshold: `${THRESHOLDS.heartRate.low}–${THRESHOLDS.heartRate.high}` });
  }

  logger.info('healthSync:analyzePatterns', { userId, alertCount: alerts.length });
  return { healthAlerts: alerts };
}

async function notifyUser(state) {
  const { userId, healthAlerts = [] } = state;

  for (const alert of healthAlerts) {
    await notifications.healthAlert(userId, alert.metric, alert.value, alert.threshold);
  }

  return { notified: healthAlerts.length };
}

// ─── Graph factory ────────────────────────────────────────────────────────────

function createHealthSyncWorkflow() {
  return new WorkflowGraph('healthSync')
    .addNode('validate',        validate)
    .addNode('storeMetrics',    storeMetrics)
    .addNode('analyzePatterns', analyzePatterns)
    .addNode('notifyUser',      notifyUser)
    .addEdge('validate',        'storeMetrics')
    .addEdge('storeMetrics',    'analyzePatterns')
    .addEdge('analyzePatterns', 'notifyUser')
    .addEdge('notifyUser',      END)
    .setEntry('validate');
}

module.exports = createHealthSyncWorkflow;
