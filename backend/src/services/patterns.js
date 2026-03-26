'use strict';

// Cross-domain pattern detection engine
// THE MOAT — insights no single-domain app can produce
//
// Correlates: health ↔ spending, mood ↔ portfolio, sleep ↔ impulse buys,
// activity ↔ savings, stress ↔ food delivery
//
// Called by: get_cross_domain_patterns tool, weekly review compose, daily check-in

const repos  = require('../repositories');
const logger = require('../lib/logger');

// ─── Pattern detectors ───────────────────────────────────────────────────────
// Each detector takes { spending, health, journal, portfolio } data arrays
// and returns { pattern, confidence, domains, insight } or null

const detectors = [
  // 1. Sleep → Spending: bad sleep correlates with higher spend
  function sleepSpending({ spending, health }) {
    if (!health.length || !spending.length) return null;

    const healthByDate = new Map();
    for (const h of health) {
      healthByDate.set(h.date, h);
    }

    let lowSleepSpend = 0, lowSleepDays = 0;
    let goodSleepSpend = 0, goodSleepDays = 0;

    for (const [date, h] of healthByDate) {
      if (!h.sleep_hours) continue;
      const daySpend = spending
        .filter(t => t.txn_date?.slice(0, 10) === date)
        .reduce((s, t) => s + t.amount, 0);

      if (h.sleep_hours < 6) {
        lowSleepSpend += daySpend;
        lowSleepDays++;
      } else {
        goodSleepSpend += daySpend;
        goodSleepDays++;
      }
    }

    if (lowSleepDays < 3 || goodSleepDays < 3) return null;

    const avgLow  = lowSleepSpend / lowSleepDays;
    const avgGood = goodSleepSpend / goodSleepDays;
    const ratio   = avgGood > 0 ? avgLow / avgGood : 0;

    if (ratio < 1.3) return null; // less than 30% difference = not significant

    return {
      pattern: 'sleep_spending',
      confidence: Math.min(0.95, 0.5 + (lowSleepDays / 20)),
      domains: ['health', 'money'],
      insight: `You spend ${Math.round((ratio - 1) * 100)}% more on days you sleep under 6 hours (₹${Math.round(avgLow)} vs ₹${Math.round(avgGood)} avg/day). ${lowSleepDays} bad-sleep days in this period.`,
      data: { avgLow: Math.round(avgLow), avgGood: Math.round(avgGood), ratio: +ratio.toFixed(2), lowSleepDays, goodSleepDays },
    };
  },

  // 2. Late-night food → skip morning exercise
  function lateNightFoodExercise({ spending, health }) {
    if (!health.length || !spending.length) return null;

    const lateOrders = spending.filter(t => {
      if (!t.txn_date || !t.category) return false;
      const hour = new Date(t.txn_date).getHours();
      return hour >= 22 && ['food_delivery', 'dining_out'].includes(t.category);
    });

    if (lateOrders.length < 3) return null;

    const healthByDate = new Map();
    for (const h of health) healthByDate.set(h.date, h);

    let skippedNext = 0;
    for (const order of lateOrders) {
      const nextDay = new Date(order.txn_date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDateStr = nextDay.toISOString().slice(0, 10);
      const nextHealth = healthByDate.get(nextDateStr);
      if (nextHealth && (nextHealth.steps || 0) < 3000) {
        skippedNext++;
      }
    }

    const skipRate = skippedNext / lateOrders.length;
    if (skipRate < 0.5) return null;

    return {
      pattern: 'late_food_skip_exercise',
      confidence: Math.min(0.9, 0.4 + skipRate * 0.5),
      domains: ['money', 'health'],
      insight: `${Math.round(skipRate * 100)}% of the time you order food after 10pm, you skip exercise the next morning. ${lateOrders.length} late orders tracked.`,
      data: { lateOrders: lateOrders.length, skippedNext, skipRate: +skipRate.toFixed(2) },
    };
  },

  // 3. Mood → Spending: stressed/anxious days = higher spend
  function moodSpending({ spending, journal }) {
    if (!journal.length || !spending.length) return null;

    const negativeMoods = ['stressed', 'anxious', 'frustrated', 'sad', 'angry', 'overwhelmed'];
    const positiveMoods = ['happy', 'calm', 'excited', 'grateful', 'content', 'energetic'];

    let negSpend = 0, negDays = 0;
    let posSpend = 0, posDays = 0;

    for (const entry of journal) {
      if (!entry.mood || !entry.created_at) continue;
      const date = entry.created_at.slice(0, 10);
      const daySpend = spending
        .filter(t => t.txn_date?.slice(0, 10) === date)
        .reduce((s, t) => s + t.amount, 0);

      if (negativeMoods.includes(entry.mood.toLowerCase())) {
        negSpend += daySpend;
        negDays++;
      } else if (positiveMoods.includes(entry.mood.toLowerCase())) {
        posSpend += daySpend;
        posDays++;
      }
    }

    if (negDays < 3 || posDays < 3) return null;

    const avgNeg = negSpend / negDays;
    const avgPos = posSpend / posDays;
    const ratio  = avgPos > 0 ? avgNeg / avgPos : 0;

    if (ratio < 1.25) return null;

    return {
      pattern: 'mood_spending',
      confidence: Math.min(0.9, 0.4 + (negDays / 15)),
      domains: ['mind', 'money'],
      insight: `On stressed/anxious days, you spend ${Math.round((ratio - 1) * 100)}% more (₹${Math.round(avgNeg)} vs ₹${Math.round(avgPos)}). Mood-driven spending detected over ${negDays} negative days.`,
      data: { avgNeg: Math.round(avgNeg), avgPos: Math.round(avgPos), ratio: +ratio.toFixed(2), negDays, posDays },
    };
  },

  // 4. Activity → Savings: active days correlate with less spending
  function activitySavings({ spending, health }) {
    if (!health.length || !spending.length) return null;

    const healthByDate = new Map();
    for (const h of health) healthByDate.set(h.date, h);

    let activeSpend = 0, activeDays = 0;
    let sedentarySpend = 0, sedentaryDays = 0;

    for (const [date, h] of healthByDate) {
      const daySpend = spending
        .filter(t => t.txn_date?.slice(0, 10) === date)
        .reduce((s, t) => s + t.amount, 0);

      if ((h.steps || 0) >= 8000) {
        activeSpend += daySpend;
        activeDays++;
      } else if ((h.steps || 0) < 4000) {
        sedentarySpend += daySpend;
        sedentaryDays++;
      }
    }

    if (activeDays < 3 || sedentaryDays < 3) return null;

    const avgActive    = activeSpend / activeDays;
    const avgSedentary = sedentarySpend / sedentaryDays;

    if (avgActive >= avgSedentary * 0.85) return null; // active days not meaningfully cheaper

    const savings = Math.round(avgSedentary - avgActive);

    return {
      pattern: 'activity_savings',
      confidence: Math.min(0.85, 0.4 + (activeDays / 20)),
      domains: ['health', 'money'],
      insight: `Active days (8k+ steps) you spend ₹${savings} less on average. That's ₹${savings * 30}/month if you stay active daily.`,
      data: { avgActive: Math.round(avgActive), avgSedentary: Math.round(avgSedentary), savings, activeDays, sedentaryDays },
    };
  },

  // 5. Food delivery habit cost projection
  function foodDeliveryHabit({ spending }) {
    if (!spending.length) return null;

    const foodDelivery = spending.filter(t =>
      t.category === 'food_delivery' || t.category === 'dining_out'
    );

    if (foodDelivery.length < 5) return null;

    const totalFood = foodDelivery.reduce((s, t) => s + t.amount, 0);
    const days = Math.max(1, Math.ceil(
      (new Date(spending[spending.length - 1]?.txn_date) - new Date(spending[0]?.txn_date)) / (1000 * 60 * 60 * 24)
    ));

    const dailyAvg    = totalFood / days;
    const monthlyProj = Math.round(dailyAvg * 30);
    const yearlyProj  = Math.round(dailyAvg * 365);

    if (yearlyProj < 50000) return null; // not significant enough

    const formatINR = (n) => {
      if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
      return `₹${n.toLocaleString('en-IN')}`;
    };

    return {
      pattern: 'food_delivery_habit',
      confidence: 0.9,
      domains: ['money'],
      insight: `Your food delivery habit = ${formatINR(yearlyProj)}/year (₹${Math.round(dailyAvg)}/day avg). ${foodDelivery.length} orders in ${days} days.`,
      data: { totalFood: Math.round(totalFood), dailyAvg: Math.round(dailyAvg), monthlyProj, yearlyProj, orderCount: foodDelivery.length },
    };
  },

  // 6. Subscription creep
  function subscriptionCreep({ spending }) {
    if (!spending.length) return null;

    const subs = spending.filter(t => t.category === 'subscriptions');
    if (subs.length < 2) return null;

    const totalSubs = subs.reduce((s, t) => s + t.amount, 0);
    const uniqueMerchants = [...new Set(subs.map(t => t.merchant))];
    const yearlyProj = Math.round(totalSubs * 12);

    if (uniqueMerchants.length < 2) return null;

    return {
      pattern: 'subscription_creep',
      confidence: 0.85,
      domains: ['money'],
      insight: `You have ${uniqueMerchants.length} active subscriptions costing ~₹${Math.round(totalSubs)}/month (₹${yearlyProj.toLocaleString('en-IN')}/year). Merchants: ${uniqueMerchants.join(', ')}.`,
      data: { monthlyTotal: Math.round(totalSubs), yearlyProj, count: uniqueMerchants.length, merchants: uniqueMerchants },
    };
  },
];

// ─── Main detection function ─────────────────────────────────────────────────

async function detectPatterns(userId, days = 30) {
  const endDate   = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // Gather data from all domains in parallel
  const [spendingResult, healthResult, journalResult] = await Promise.allSettled([
    repos.transactions.querySpending(userId, { type: 'debit', startDate, endDate }),
    repos.healthData.queryRange(userId, startDate, endDate),
    repos.journalEntries.loadInsights(userId, startDate),
  ]);

  const spending = spendingResult.status === 'fulfilled' ? (spendingResult.value?.data || []) : [];
  const health   = healthResult.status === 'fulfilled'   ? (healthResult.value?.data   || []) : [];
  const journal  = journalResult.status === 'fulfilled'  ? (journalResult.value?.data  || []) : [];

  const context = { spending, health, journal };

  // Run all detectors
  const patterns = [];
  for (const detect of detectors) {
    try {
      const result = detect(context);
      if (result) patterns.push(result);
    } catch (err) {
      logger.warn('Pattern detector error', { detector: detect.name, err: err.message });
    }
  }

  // Sort by confidence (highest first)
  patterns.sort((a, b) => b.confidence - a.confidence);

  logger.info('Pattern detection complete', { userId, days, patternsFound: patterns.length });

  return {
    patterns,
    period: { start: startDate, end: endDate, days },
    data_available: {
      spending: spending.length,
      health: health.length,
      journal: journal.length,
    },
    summary: patterns.length > 0
      ? `Found ${patterns.length} cross-domain pattern${patterns.length > 1 ? 's' : ''} across ${days} days.`
      : `No significant patterns detected yet. Need more data — keep syncing SMS, health, and journal entries.`,
  };
}

// ─── Purchase advisor ────────────────────────────────────────────────────────
// "Can I afford this?" with real financial context

async function canIAfford(userId, itemName, itemPrice) {
  const now = new Date();
  const monthStr = now.toISOString().slice(0, 7);

  // Gather financial state in parallel
  const [spendingResult, salaryResult, portfolioResult] = await Promise.allSettled([
    repos.transactions.querySpending(userId, {
      type: 'debit',
      startDate: `${monthStr}-01`,
      endDate: now.toISOString().slice(0, 10),
    }),
    repos.transactions.querySpending(userId, {
      type: 'credit',
      startDate: `${monthStr}-01`,
      endDate: now.toISOString().slice(0, 10),
    }),
    (async () => {
      const brokers = require('../brokers');
      return brokers.getPortfolio(userId);
    })(),
  ]);

  const debits  = spendingResult.status === 'fulfilled' ? (spendingResult.value?.data || []) : [];
  const credits = salaryResult.status === 'fulfilled'   ? (salaryResult.value?.data  || []) : [];
  const portfolio = portfolioResult.status === 'fulfilled' ? portfolioResult.value : null;

  const totalSpent = debits.reduce((s, t) => s + t.amount, 0);
  const salary = credits.filter(t => t.amount >= 10000).sort((a, b) => b.amount - a.amount)[0];
  const salaryAmount = salary?.amount || 0;

  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth   = now.getDate();
  const remainingDays = daysInMonth - dayOfMonth;
  const remainingBudget = salaryAmount - totalSpent - itemPrice;
  const dailyBudgetAfter = remainingDays > 0 ? Math.round(remainingBudget / remainingDays) : 0;

  // Category spending this month
  const categoryMap = {};
  for (const t of debits) {
    categoryMap[t.category || 'others'] = (categoryMap[t.category || 'others'] || 0) + t.amount;
  }

  // Price as percentage of salary
  const salaryPercent = salaryAmount > 0 ? +((itemPrice / salaryAmount) * 100).toFixed(1) : null;

  // Portfolio context
  const portfolioValue = portfolio?.total_value || 0;
  const priceVsPortfolio = portfolioValue > 0 ? +((itemPrice / portfolioValue) * 100).toFixed(2) : null;

  const formatINR = (n) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

  const verdict = remainingBudget > 0 && dailyBudgetAfter > 500
    ? 'yes'
    : remainingBudget > 0
      ? 'tight'
      : 'no';

  return {
    item: itemName,
    price: itemPrice,
    price_display: formatINR(itemPrice),
    verdict,
    salary_this_month: salaryAmount,
    spent_so_far: Math.round(totalSpent),
    remaining_before_purchase: Math.round(salaryAmount - totalSpent),
    remaining_after_purchase: Math.round(remainingBudget),
    daily_budget_after: dailyBudgetAfter,
    remaining_days: remainingDays,
    salary_percent: salaryPercent,
    portfolio_percent: priceVsPortfolio,
    portfolio_value: portfolioValue,
    top_spending_categories: Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, amt]) => ({ category: cat, amount: Math.round(amt) })),
    context_hints: [
      salaryPercent && salaryPercent > 30 ? `This is ${salaryPercent}% of your monthly salary` : null,
      dailyBudgetAfter < 300 ? `After this purchase, your daily budget drops to ${formatINR(dailyBudgetAfter)}` : null,
      priceVsPortfolio && priceVsPortfolio > 5 ? `This equals ${priceVsPortfolio}% of your portfolio value` : null,
      verdict === 'no' ? 'You would exceed your monthly budget with this purchase' : null,
    ].filter(Boolean),
  };
}

module.exports = { detectPatterns, canIAfford };
