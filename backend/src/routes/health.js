// Arogya Agent — Health & Fitness
// Receives health data from mobile (Health Connect API), stores, correlates with spending

const express = require('express');
const router = express.Router();
const repos = require('../repositories');
const config = require('../lib/config');

const V = config.VALIDATION;

// POST /api/health/sync — mobile sends daily health data
router.post('/sync', async (req, res) => {
  const userId = req.userId;
  const { data } = req.body;

  if (!data || !data.entry_date) {
    return res.status(400).json({ error: 'Health data with entry_date required' });
  }

  if (!V.DATE_REGEX.test(data.entry_date)) {
    return res.status(400).json({ error: 'entry_date must be YYYY-MM-DD format' });
  }

  if (data.steps != null && (data.steps < 0 || data.steps > V.MAX_STEPS)) {
    return res.status(400).json({ error: `steps must be 0-${V.MAX_STEPS}` });
  }
  if (data.sleep_hours != null && (data.sleep_hours < 0 || data.sleep_hours > V.MAX_SLEEP_HOURS)) {
    return res.status(400).json({ error: `sleep_hours must be 0-${V.MAX_SLEEP_HOURS}` });
  }
  if (data.heart_rate_avg != null && (data.heart_rate_avg < V.MIN_HEART_RATE || data.heart_rate_avg > V.MAX_HEART_RATE)) {
    return res.status(400).json({ error: `heart_rate_avg must be ${V.MIN_HEART_RATE}-${V.MAX_HEART_RATE}` });
  }

  const row = {
    user_id: userId,
    entry_date: data.entry_date,
    steps: data.steps || null,
    sleep_hours: data.sleep_hours || null,
    heart_rate_avg: data.heart_rate_avg || null,
    heart_rate_min: data.heart_rate_min || null,
    heart_rate_max: data.heart_rate_max || null,
    calories_burned: data.calories_burned || null,
    active_minutes: data.active_minutes || null,
    weight: data.weight || null,
    source: data.source || 'health_connect',
  };

  const { error } = await repos.healthData.upsert(row);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/health/summary — recent health overview
router.get('/summary', async (req, res) => {
  const userId = req.userId;
  const { days = 7 } = req.query;
  const safeDays = Math.min(Math.max(1, parseInt(days) || 7), 365);
  const summary = await getHealthSummary(userId, safeDays);
  res.json(summary);
});

// GET /api/health/status
router.get('/status', async (req, res) => {
  const userId = req.userId;
  const recent = await repos.healthData.loadRecent(userId, 1);
  const hasData = recent.data && recent.data.length > 0;

  res.json({ connected: hasData, data_points: hasData ? 1 : 0 });
});

// --- Health Summary ---
async function getHealthSummary(userId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const endDate = new Date().toISOString().slice(0, 10);
  const { data, error } = await repos.healthData.queryRange(userId, since.toISOString().slice(0, 10), endDate);

  if (error) return { error: error.message };

  const entries = data || [];
  if (entries.length === 0) {
    return {
      message: 'No health data yet. Sync Health Connect from the app to start tracking.',
      connected: false,
    };
  }

  const avgSteps = avg(entries, 'steps');
  const avgSleep = avg(entries, 'sleep_hours');
  const avgHR = avg(entries, 'heart_rate_avg');
  const avgCalories = avg(entries, 'calories_burned');
  const avgActive = avg(entries, 'active_minutes');
  const totalSteps = entries.reduce((s, e) => s + (e.steps || 0), 0);

  // Today's data
  const today = entries[0];

  return {
    period: `Last ${days} days`,
    days_tracked: entries.length,
    today: today ? {
      steps: today.steps,
      sleep_hours: today.sleep_hours,
      heart_rate: today.heart_rate_avg,
      calories: today.calories_burned,
      active_minutes: today.active_minutes,
    } : null,
    averages: {
      steps: avgSteps,
      sleep_hours: avgSleep ? parseFloat(avgSleep.toFixed(1)) : null,
      heart_rate: avgHR,
      calories_burned: avgCalories,
      active_minutes: avgActive,
    },
    total_steps: totalSteps,
    sleep_quality: avgSleep ? (avgSleep >= 7 ? 'good' : avgSleep >= 5.5 ? 'fair' : 'poor') : null,
    activity_level: avgSteps ? (avgSteps >= 8000 ? 'active' : avgSteps >= 5000 ? 'moderate' : 'sedentary') : null,
  };
}

function avg(arr, field) {
  const vals = arr.filter(e => e[field] != null).map(e => e[field]);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// --- Health-Spending Correlation ---
async function getHealthSpendingCorrelation(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  // Get health data
  const endDate = new Date().toISOString().slice(0, 10);
  const { data: healthEntries } = await repos.healthData.queryRange(userId, sinceStr, endDate);

  // Get spending data
  const { data: spendingEntries } = await repos.transactions.querySpending(userId, {
    type: 'debit', startDate: sinceStr,
  });

  const health = healthEntries || [];
  const spending = spendingEntries || [];

  if (health.length < 3) {
    return { message: 'Need at least 3 days of health data to find patterns. Keep syncing!' };
  }

  // Group spending by date
  const dailySpending = {};
  for (const t of spending) {
    dailySpending[t.txn_date] = (dailySpending[t.txn_date] || 0) + t.amount;
  }

  // Food delivery spending by date
  const foodSpending = {};
  for (const t of spending) {
    if (t.category === 'food_delivery') {
      foodSpending[t.txn_date] = (foodSpending[t.txn_date] || 0) + t.amount;
    }
  }

  // Correlate sleep with next-day spending
  const badSleepDays = []; // sleep < 6 hours
  const goodSleepDays = []; // sleep >= 7 hours
  const lowStepDays = []; // steps < 4000
  const activeStepDays = []; // steps >= 8000

  for (const h of health) {
    const spend = dailySpending[h.entry_date] || 0;
    const food = foodSpending[h.entry_date] || 0;

    if (h.sleep_hours && h.sleep_hours < 6) {
      badSleepDays.push({ date: h.entry_date, sleep: h.sleep_hours, spending: spend, food_delivery: food });
    }
    if (h.sleep_hours && h.sleep_hours >= 7) {
      goodSleepDays.push({ date: h.entry_date, sleep: h.sleep_hours, spending: spend, food_delivery: food });
    }
    if (h.steps && h.steps < 4000) {
      lowStepDays.push({ date: h.entry_date, steps: h.steps, spending: spend, food_delivery: food });
    }
    if (h.steps && h.steps >= 8000) {
      activeStepDays.push({ date: h.entry_date, steps: h.steps, spending: spend, food_delivery: food });
    }
  }

  const avgBadSleepSpend = badSleepDays.length > 0 ? badSleepDays.reduce((s, d) => s + d.spending, 0) / badSleepDays.length : 0;
  const avgGoodSleepSpend = goodSleepDays.length > 0 ? goodSleepDays.reduce((s, d) => s + d.spending, 0) / goodSleepDays.length : 0;
  const avgBadSleepFood = badSleepDays.length > 0 ? badSleepDays.reduce((s, d) => s + d.food_delivery, 0) / badSleepDays.length : 0;
  const avgGoodSleepFood = goodSleepDays.length > 0 ? goodSleepDays.reduce((s, d) => s + d.food_delivery, 0) / goodSleepDays.length : 0;

  const patterns = [];

  if (badSleepDays.length >= 2 && goodSleepDays.length >= 2) {
    if (avgBadSleepSpend > avgGoodSleepSpend * 1.2) {
      patterns.push({
        pattern: 'sleep_spending',
        insight: `You spend ${Math.round((avgBadSleepSpend / avgGoodSleepSpend - 1) * 100)}% more on days with poor sleep (<6hrs)`,
        bad_sleep_avg_spend: parseFloat(avgBadSleepSpend.toFixed(2)),
        good_sleep_avg_spend: parseFloat(avgGoodSleepSpend.toFixed(2)),
      });
    }
    if (avgBadSleepFood > avgGoodSleepFood * 1.3) {
      patterns.push({
        pattern: 'sleep_food_delivery',
        insight: `Food delivery spending is ${Math.round((avgBadSleepFood / avgGoodSleepFood - 1) * 100)}% higher on bad sleep days`,
        bad_sleep_avg_food: parseFloat(avgBadSleepFood.toFixed(2)),
        good_sleep_avg_food: parseFloat(avgGoodSleepFood.toFixed(2)),
      });
    }
  }

  const avgLowStepSpend = lowStepDays.length > 0 ? lowStepDays.reduce((s, d) => s + d.spending, 0) / lowStepDays.length : 0;
  const avgActiveSpend = activeStepDays.length > 0 ? activeStepDays.reduce((s, d) => s + d.spending, 0) / activeStepDays.length : 0;

  if (lowStepDays.length >= 2 && activeStepDays.length >= 2 && avgLowStepSpend > avgActiveSpend * 1.15) {
    patterns.push({
      pattern: 'activity_spending',
      insight: `Sedentary days (<4K steps) cost you ${Math.round((avgLowStepSpend / avgActiveSpend - 1) * 100)}% more than active days (8K+ steps)`,
      sedentary_avg_spend: parseFloat(avgLowStepSpend.toFixed(2)),
      active_avg_spend: parseFloat(avgActiveSpend.toFixed(2)),
    });
  }

  return {
    analysis_period: `${days} days`,
    data_points: health.length,
    patterns: patterns.length > 0 ? patterns : [{ pattern: 'none_yet', insight: 'Not enough data to find strong patterns yet. Keep tracking!' }],
    bad_sleep_days: badSleepDays.length,
    good_sleep_days: goodSleepDays.length,
    sedentary_days: lowStepDays.length,
    active_days: activeStepDays.length,
  };
}

module.exports = router;
module.exports.getHealthSummary = getHealthSummary;
module.exports.getHealthSpendingCorrelation = getHealthSpendingCorrelation;
