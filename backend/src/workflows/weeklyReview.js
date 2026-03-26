'use strict';

// Sunday Briefing — cross-domain AI weekly report
//
// Triggered by: scheduler (every Sunday 09:00 IST) or POST /api/workflows/trigger/weeklyReview
// Graph: gatherSpending → gatherHealth → gatherPortfolio → gatherJournal → compose → notifyUser → __end__
//
// The moat: cross-domain patterns (sleep→spending, mood→portfolio, stress→impulse buys)
// Output: AI-written narrative stored as a weekly_review notification

const { WorkflowGraph, END } = require('./engine');
const { notifications }      = require('./notifications');
const repos                  = require('../repositories');
const brokers                = require('../brokers');
const logger                 = require('../lib/logger');
const { chat }               = require('../lib/ai');
const config                 = require('../lib/config');

// ─── Date helpers ──────────────────────────────────────────────────────────────

function getWeekRange(weeksAgo = 0) {
  const now    = new Date();
  const day    = now.getDay(); // 0=Sun
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

// ─── Gather nodes ──────────────────────────────────────────────────────────────

async function gatherSpending(state) {
  const { userId } = state;
  const thisWeek = getWeekRange(0);
  const lastWeek = getWeekRange(1);

  const [thisResult, lastResult] = await Promise.allSettled([
    repos.transactions.querySpending(userId, { type: 'debit', startDate: thisWeek.start, endDate: thisWeek.end }),
    repos.transactions.querySpending(userId, { type: 'debit', startDate: lastWeek.start, endDate: lastWeek.end }),
  ]);

  const thisData  = thisResult.status === 'fulfilled' ? (thisResult.value?.data  || []) : [];
  const lastData  = lastResult.status === 'fulfilled' ? (lastResult.value?.data  || []) : [];

  const thisTotal = thisData.reduce((s, t) => s + t.amount, 0);
  const lastTotal = lastData.reduce((s, t) => s + t.amount, 0);
  const vsLastWeek = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;

  // Category breakdown
  const catMap = {};
  for (const t of thisData) {
    catMap[t.category || 'others'] = (catMap[t.category || 'others'] || 0) + t.amount;
  }
  const categories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat, amt]) => ({ category: cat, amount: Math.round(amt) }));

  const topCategory = categories[0]?.category || 'others';

  logger.info('weeklyReview:gatherSpending', { userId, thisTotal, lastTotal, topCategory });

  return {
    thisWeekSpend: Math.round(thisTotal),
    lastWeekSpend: Math.round(lastTotal),
    vsLastWeek:    parseFloat(vsLastWeek.toFixed(1)),
    topCategory,
    spendCategories: categories,
    txnCount: thisData.length,
    weekRange: thisWeek,
  };
}

async function gatherHealth(state) {
  const { userId } = state;
  const thisWeek = getWeekRange(0);

  const { data } = await repos.healthData.queryRange(userId, thisWeek.start, thisWeek.end);
  if (!data?.length) return { avgSteps: 0, avgSleep: 0, avgHR: 0, activeDays: 0, healthAvailable: false };

  const activeDays = data.filter(d => (d.steps || 0) > 2000).length;
  const avgSteps   = Math.round(data.reduce((s, d) => s + (d.steps || 0), 0) / data.length);
  const avgSleep   = parseFloat((data.reduce((s, d) => s + (d.sleep_hours || 0), 0) / data.length).toFixed(1));
  const hrData     = data.filter(d => d.heart_rate_avg);
  const avgHR      = hrData.length ? Math.round(hrData.reduce((s, d) => s + d.heart_rate_avg, 0) / hrData.length) : 0;

  // Cross-domain: high spend days vs low sleep days
  const sleepSpendPattern = data
    .filter(d => d.sleep_hours && d.sleep_hours < 6)
    .length;

  return { avgSteps, avgSleep, avgHR, activeDays, healthAvailable: true, lowSleepDays: sleepSpendPattern };
}

async function gatherPortfolio(state) {
  const { userId } = state;

  try {
    const isConnected = await brokers.anyConnected(userId);
    if (!isConnected) return { portfolioAvailable: false };

    const portfolio = await brokers.getPortfolio(userId);
    if (!portfolio?.holdings?.length) return { portfolioAvailable: false };

    const totalValue  = portfolio.holdings.reduce((s, h) => s + (h.current_value || 0), 0);
    const totalPnl    = portfolio.holdings.reduce((s, h) => s + (h.pnl || 0), 0);
    const pnlPct      = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;

    const topGainer = portfolio.holdings
      .filter(h => h.pnl_percent > 0)
      .sort((a, b) => b.pnl_percent - a.pnl_percent)[0];
    const topLoser = portfolio.holdings
      .filter(h => h.pnl_percent < 0)
      .sort((a, b) => a.pnl_percent - b.pnl_percent)[0];

    return {
      portfolioAvailable: true,
      portfolioValue:     Math.round(totalValue),
      weeklyPnl:          Math.round(totalPnl),
      weeklyPnlPct:       parseFloat(pnlPct.toFixed(2)),
      holdingsCount:      portfolio.holdings.length,
      topGainer:          topGainer ? { symbol: topGainer.symbol, pct: topGainer.pnl_percent } : null,
      topLoser:           topLoser  ? { symbol: topLoser.symbol,  pct: topLoser.pnl_percent  } : null,
      brokers:            portfolio.sources || [],
    };
  } catch (err) {
    logger.warn('weeklyReview:gatherPortfolio failed', { userId, err: err.message });
    return { portfolioAvailable: false };
  }
}

async function gatherJournal(state) {
  const { userId } = state;
  const weekAgo = getWeekRange(0).start;

  const { data } = await repos.journalEntries.loadInsights(userId, weekAgo);
  if (!data?.length) return { journalAvailable: false };

  const moodCounts = {};
  for (const e of data) {
    if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
  }
  const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const avgEnergy    = data.filter(e => e.energy_level).length
    ? parseFloat((data.filter(e => e.energy_level).reduce((s, e) => s + e.energy_level, 0) / data.filter(e => e.energy_level).length).toFixed(1))
    : null;

  return { journalAvailable: true, dominantMood, avgEnergy, journalDays: data.length };
}

// ─── Compose with AI ──────────────────────────────────────────────────────────

async function compose(state) {
  const {
    userId,
    thisWeekSpend, lastWeekSpend, vsLastWeek, topCategory, spendCategories, txnCount,
    avgSteps, avgSleep, avgHR, activeDays, healthAvailable, lowSleepDays,
    portfolioAvailable, portfolioValue, weeklyPnl, weeklyPnlPct, topGainer, topLoser,
    journalAvailable, dominantMood, avgEnergy,
    weekRange,
  } = state;

  // Build data summary for AI
  const dataParts = [];

  dataParts.push(`SPENDING THIS WEEK:
- Total spent: Rs ${thisWeekSpend.toLocaleString('en-IN')}
- vs last week: ${vsLastWeek > 0 ? '+' : ''}${vsLastWeek}%
- Top category: ${topCategory} (Rs ${spendCategories[0]?.amount?.toLocaleString('en-IN') || 0})
- Transactions: ${txnCount}
${spendCategories.length > 1 ? '- Other categories: ' + spendCategories.slice(1).map(c => `${c.category} Rs ${c.amount.toLocaleString('en-IN')}`).join(', ') : ''}`);

  if (portfolioAvailable) {
    dataParts.push(`PORTFOLIO:
- Total value: Rs ${portfolioValue?.toLocaleString('en-IN')}
- Weekly P&L: ${weeklyPnl >= 0 ? '+' : ''}Rs ${Math.abs(weeklyPnl).toLocaleString('en-IN')} (${weeklyPnlPct}%)
${topGainer ? `- Best performer: ${topGainer.symbol} +${topGainer.pct}%` : ''}
${topLoser  ? `- Worst performer: ${topLoser.symbol} ${topLoser.pct}%` : ''}`);
  }

  if (healthAvailable) {
    dataParts.push(`HEALTH:
- Avg steps/day: ${avgSteps?.toLocaleString('en-IN')}
- Avg sleep: ${avgSleep}h
${avgHR ? `- Avg heart rate: ${avgHR} bpm` : ''}
- Active days: ${activeDays}/7
${lowSleepDays > 2 ? `- Warning: ${lowSleepDays} days with <6h sleep this week` : ''}`);
  }

  if (journalAvailable) {
    dataParts.push(`MOOD & ENERGY:
- Dominant mood: ${dominantMood}
${avgEnergy ? `- Avg energy level: ${avgEnergy}/5` : ''}
- Logged ${state.journalDays} journal entries`);
  }

  // Cross-domain pattern hints for AI
  const crossDomainHints = [];
  if (healthAvailable && lowSleepDays > 2 && thisWeekSpend > lastWeekSpend) {
    crossDomainHints.push('Sleep was low AND spending was up this week — possible stress spending pattern');
  }
  if (journalAvailable && dominantMood === 'stressed' && thisWeekSpend > lastWeekSpend * 1.2) {
    crossDomainHints.push('Stressed mood correlated with 20%+ higher spending');
  }
  if (healthAvailable && avgSteps > 8000 && portfolioAvailable && weeklyPnl > 0) {
    crossDomainHints.push('High activity week AND positive portfolio — good week overall');
  }

  const prompt = `Write a Sunday Briefing for the user. Tone: direct, warm, like a smart friend reviewing your week with you.

DATA:
${dataParts.join('\n\n')}
${crossDomainHints.length ? '\nCROSS-DOMAIN PATTERNS TO HIGHLIGHT:\n' + crossDomainHints.join('\n') : ''}

FORMAT:
- Start with a 1-line week summary (honest, not sugarcoated)
- Money section: what they spent, vs last week, top category, any red flags
${portfolioAvailable ? '- Portfolio section: P&L, standout movers\n' : ''}- ${healthAvailable ? 'Health section: steps, sleep, any patterns\n' : ''}- ${journalAvailable ? 'Mood section: how the week felt\n' : ''}- End with ONE specific action for next week (not generic advice)

Keep it under 250 words. No bullet soup — write in short paragraphs. Be honest, not cheerleader.`;

  let briefingText = '';
  try {
    const aiResponse = await chat({
      messages:          [{ role: 'user', content: prompt }],
      tools:             [],
      tone:              'pro',
      connectedServices: [],
      systemExtra:       'You are writing a Sunday Briefing — a weekly personal finance and life summary. Be honest and specific. Use real numbers from the data.',
    });
    briefingText = aiResponse.content || '';
  } catch (err) {
    logger.warn('weeklyReview:compose AI failed', { userId, err: err.message });
    // Fallback: structured summary without AI narrative
    briefingText = `Week of ${config.formatDateIN(weekRange?.start)} — Spending Rs ${thisWeekSpend.toLocaleString('en-IN')} (${vsLastWeek > 0 ? '+' : ''}${vsLastWeek}% vs last week). Top: ${topCategory}.${healthAvailable ? ` Avg sleep ${avgSleep}h, ${avgSteps} steps/day.` : ''}`;
  }

  logger.info('weeklyReview:compose', { userId, briefingLength: briefingText.length });

  return {
    weeklySummary: {
      weekTotal:    thisWeekSpend,
      vsLastWeek,
      topCategory,
      avgSteps:     avgSteps || 0,
      avgSleep:     avgSleep || 0,
      composedAt:   new Date().toISOString(),
      briefingText,
    },
  };
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

  // Also store the full AI briefing as a separate notification
  if (weeklySummary.briefingText) {
    await repos.notifications.insert({
      user_id:  userId,
      type:     'sunday_briefing',
      message:  weeklySummary.briefingText,
      data:     {
        weekTotal:   weeklySummary.weekTotal,
        vsLastWeek:  weeklySummary.vsLastWeek,
        topCategory: weeklySummary.topCategory,
        avgSteps:    weeklySummary.avgSteps,
        avgSleep:    weeklySummary.avgSleep,
      },
      priority: 'high',
      read:     false,
    });
  }

  return { notified: true };
}

// ─── Graph factory ────────────────────────────────────────────────────────────

function createWeeklyReviewWorkflow() {
  return new WorkflowGraph('weeklyReview')
    .addNode('gatherSpending',  gatherSpending)
    .addNode('gatherHealth',    gatherHealth)
    .addNode('gatherPortfolio', gatherPortfolio)
    .addNode('gatherJournal',   gatherJournal)
    .addNode('compose',         compose)
    .addNode('notifyUser',      notifyUser)
    .addEdge('gatherSpending',  'gatherHealth')
    .addEdge('gatherHealth',    'gatherPortfolio')
    .addEdge('gatherPortfolio', 'gatherJournal')
    .addEdge('gatherJournal',   'compose')
    .addEdge('compose',         'notifyUser')
    .addEdge('notifyUser',      END)
    .setEntry('gatherSpending');
}

module.exports = createWeeklyReviewWorkflow;
