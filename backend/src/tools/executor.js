// Tool executor — when OpenAI calls a tool, this runs the actual function

const gmail        = require('../routes/gmail');
const calendar     = require('../routes/calendar');
const cas          = require('../routes/cas');
const sms          = require('../routes/sms');
const screener     = require('../services/screener');
const journal      = require('../routes/journal');
const career       = require('../routes/career');
const health       = require('../routes/health');
const brokers      = require('../brokers');
const repos        = require('../repositories');
const yahooFinance = require('yahoo-finance2').default;
const { withCache, TTL } = require('../lib/cache');
const logger       = require('../lib/logger');
const config       = require('../lib/config');

async function executeTool(toolName, toolArgs, userContext) {
  switch (toolName) {
    case 'get_portfolio':
      return await withCache(`portfolio:${userContext.userId}`, TTL.PORTFOLIO,
        () => brokers.getPortfolio(userContext.userId));
    case 'get_portfolio_chart':
      return await withCache(`portfolio_chart:${userContext.userId}`, TTL.PORTFOLIO,
        () => getPortfolioChart(userContext));
    case 'get_stock_price':
      return await withCache(`stock:${toolArgs.symbol}`, TTL.STOCK_PRICE,
        () => getStockPrice(toolArgs.symbol));
    case 'get_emails':
      return await getEmails(Math.min(toolArgs.count || 10, 50), userContext);
    case 'search_emails':
      return await searchEmails(toolArgs.query, Math.min(toolArgs.count || 10, 50), userContext);
    case 'get_monthly_spending':
      return await getMonthlySpending(toolArgs.month, userContext);
    case 'get_mutual_funds':
      return await cas.parseCas(userContext.userId, toolArgs.password || '');
    case 'get_financials':
      return await withCache(`financials:${toolArgs.symbol}`, TTL.FINANCIALS,
        () => screener.getFinancials(toolArgs.symbol));
    case 'get_quarterly_results':
      return await withCache(`quarterly:${toolArgs.symbol}`, TTL.FINANCIALS,
        () => screener.getQuarterlyResults(toolArgs.symbol));
    case 'get_concalls':
      return await withCache(`concalls:${toolArgs.symbol}`, TTL.FINANCIALS,
        () => screener.getConcalls(toolArgs.symbol));
    // --- Chitta Agent: Journaling ---
    case 'save_journal_entry':
      return await journal.saveJournalEntry(toolArgs.content, userContext.userId);
    case 'get_journal_insights':
      return await journal.getJournalInsights(userContext.userId, toolArgs.days || 30);
    case 'get_daily_checkin':
      return await journal.getDailyCheckIn(userContext.userId);
    // --- Artha Agent: Weekly Review + Salary + Net Worth ---
    case 'get_weekly_review':
      return await getWeeklyReview(userContext);
    case 'detect_salary':
      return await detectSalary(toolArgs.month, userContext);
    case 'get_net_worth':
      return await getNetWorth(userContext);
    // --- Karma Agent: Career ---
    case 'get_career_advice':
      return await career.getCareerAdvice(toolArgs.query, userContext.userId);
    case 'search_job_emails':
      return await career.searchJobEmails(userContext.userId);
    case 'get_interview_prep':
      return await career.getInterviewPrep(toolArgs.company, toolArgs.role, userContext.userId);
    case 'get_salary_negotiation':
      return await career.getSalaryNegotiation(toolArgs.current_salary || 0, toolArgs.offered_salary, toolArgs.role, userContext.userId);
    case 'track_job_application':
      return await career.trackJobApplication(toolArgs.company, toolArgs.role, toolArgs.status, userContext.userId);
    case 'score_job_fit':
      return await career.scoreJobFit(toolArgs.job_description, userContext.userId);
    // --- Kaal Agent: Time/Productivity ---
    case 'get_today_schedule':
      return await withCache(`schedule:${userContext.userId}:today`, TTL.STOCK_PRICE,
        () => getTodaySchedule(userContext));
    case 'get_upcoming_events':
      return await withCache(`schedule:${userContext.userId}:upcoming:${toolArgs.days || 7}`, TTL.STOCK_PRICE,
        () => getUpcomingEvents(toolArgs.days || 7, userContext));
    case 'get_free_slots':
      return await getFreeSlots(userContext);
    // --- Arogya Agent: Health ---
    case 'get_health_summary':
      return await health.getHealthSummary(userContext.userId, toolArgs.days || 7);
    case 'get_health_spending_correlation':
      return await health.getHealthSpendingCorrelation(userContext.userId, toolArgs.days || 30);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// --- Portfolio 1-Year Chart ---
async function getPortfolioChart(userContext) {
  const portfolio = await brokers.getPortfolio(userContext.userId);
  if (portfolio.error) return portfolio;

  const holdings = portfolio.holdings;
  if (!holdings || holdings.length === 0) return { error: 'No holdings found' };

  // Date range: 1 year back to today, monthly points
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  // Fetch 1-year historical prices with concurrency limit (max 5 at a time)
  const CONCURRENCY = 5;
  const TIMEOUT_MS = 8000;
  const historicalData = [];
  for (let i = 0; i < holdings.length; i += CONCURRENCY) {
    const batch = holdings.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (h) => {
        try {
          const result = await Promise.race([
            yahooFinance.historical(`${h.symbol}.NS`, {
              period1: startDate,
              period2: endDate,
              interval: '1mo',
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
          ]);
          return { symbol: h.symbol, qty: h.qty, history: result };
        } catch {
          return { symbol: h.symbol, qty: h.qty, history: [] };
        }
      })
    );
    historicalData.push(...results);
  }

  // Build monthly portfolio value by summing (price × qty) for each stock at each date
  const monthlyTotals = {};

  for (const stock of historicalData) {
    for (const point of stock.history) {
      const label = point.date.toISOString().slice(0, 7); // "2025-03"
      if (!monthlyTotals[label]) monthlyTotals[label] = 0;
      monthlyTotals[label] += (point.close || 0) * stock.qty;
    }
  }

  const sortedLabels = Object.keys(monthlyTotals).sort();
  const values = sortedLabels.map(l => parseFloat(monthlyTotals[l].toFixed(2)));

  // Format labels as "Apr 2025"
  const displayLabels = sortedLabels.map(l => {
    const [yr, mo] = l.split('-');
    return new Date(parseInt(yr), parseInt(mo) - 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  });

  return {
    chart_data: {
      type: 'portfolio_history',
      labels: displayLabels,
      values,
      current_value: portfolio.total_value,
      total_invested: portfolio.total_invested,
      total_pnl: portfolio.total_pnl,
      total_pnl_percent: portfolio.total_pnl_percent,
    },
    summary: `Portfolio chart data ready. Current value ₹${portfolio.total_value.toLocaleString('en-IN')}, invested ₹${portfolio.total_invested.toLocaleString('en-IN')}, P&L ${portfolio.total_pnl_percent}%.`,
  };
}

// --- Stock Price (real data via Yahoo Finance) ---
async function getStockPrice(symbol) {
  // Indian NSE stocks need .NS suffix on Yahoo Finance
  const yahooSymbol = `${symbol.toUpperCase()}.NS`;

  try {
    const quote = await yahooFinance.quote(yahooSymbol);

    return {
      symbol: symbol.toUpperCase(),
      name: quote.longName || quote.shortName || symbol,
      price: parseFloat(quote.regularMarketPrice.toFixed(2)),
      change: parseFloat(quote.regularMarketChange.toFixed(2)),
      change_percent: parseFloat(quote.regularMarketChangePercent.toFixed(2)),
      day_high: parseFloat(quote.regularMarketDayHigh.toFixed(2)),
      day_low: parseFloat(quote.regularMarketDayLow.toFixed(2)),
      week_52_high: parseFloat((quote.fiftyTwoWeekHigh || 0).toFixed(2)),
      week_52_low: parseFloat((quote.fiftyTwoWeekLow || 0).toFixed(2)),
      volume: quote.regularMarketVolume,
      market_cap: quote.marketCap,
    };
  } catch (err) {
    return { error: `Could not fetch price for ${symbol}. Verify the NSE symbol is correct.` };
  }
}

// --- Email Search ---
async function searchEmails(query, count, userContext) {
  const connected = await gmail.isConnected(userContext.userId);
  if (!connected) {
    return {
      error: 'Gmail not connected',
      action: 'Ask the user to connect Gmail by tapping the Gmail button in the status bar.',
    };
  }

  try {
    const result = await gmail.searchEmails(userContext.userId, query, count);
    return result;
  } catch (err) {
    return { error: `Failed to search emails: ${err.message}` };
  }
}

// --- Monthly Spending (from SMS + Gmail transactions) ---
async function getMonthlySpending(month, userContext) {
  const targetMonth = month || new Date().toISOString().slice(0, 7);

  // Auto-sync Gmail bank emails if connected — catches users with different registered numbers
  const gmailConnected = await gmail.isConnected(userContext.userId);
  if (gmailConnected) {
    sms.syncEmailTransactions(userContext.userId).catch(err =>
      logger.error('Email transaction sync error', { err: err.message })
    );
  }

  const result = await sms.getSpending(userContext.userId, targetMonth);
  if (result.error) return result;

  if (result.transaction_count === 0) {
    const sources = [];
    if (gmailConnected) sources.push('Gmail (syncing bank emails)');
    return {
      error: 'No spending data yet',
      action: `To track expenses automatically: ${sources.length ? sources.join(' + ') + ' is connected and being synced. ' : ''}Allow SMS access in the app to read bank alerts from your registered mobile number.`,
    };
  }

  return {
    month: targetMonth,
    data_sources: gmailConnected ? 'SMS + Gmail' : 'SMS only',
    ...result,
  };
}

// --- Emails ---
async function getEmails(count, userContext) {
  const connected = await gmail.isConnected(userContext.userId);
  if (!connected) {
    return {
      error: 'Gmail not connected',
      action: 'Ask the user to connect Gmail by tapping the Gmail button in the status bar.',
    };
  }

  try {
    const result = await gmail.fetchEmails(userContext.userId, count);
    return result;
  } catch (err) {
    return { error: `Failed to fetch emails: ${err.message}` };
  }
}

// --- Weekly Spending Review ---
async function getWeeklyReview(userContext) {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const todayStr = today.toISOString().slice(0, 10);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().slice(0, 10);

  // This week's transactions (via repository)
  const { data: thisWeek } = await repos.transactions.querySpending(userContext.userId, {
    type: 'debit', startDate: weekAgoStr, endDate: todayStr,
  });

  // Last week's transactions (for comparison)
  const { data: lastWeek } = await repos.transactions.querySpending(userContext.userId, {
    type: 'debit', startDate: twoWeeksAgoStr, endDate: weekAgoStr,
  });

  const thisWeekData = thisWeek || [];
  const lastWeekData = lastWeek || [];

  if (thisWeekData.length === 0) {
    return { error: 'No spending data this week. Sync SMS or connect Gmail to track expenses.' };
  }

  const thisTotal = thisWeekData.reduce((s, t) => s + t.amount, 0);
  const lastTotal = lastWeekData.reduce((s, t) => s + t.amount, 0);
  const changePercent = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal * 100) : 0;

  // Category breakdown this week
  const byCategory = {};
  const byMerchant = {};
  for (const t of thisWeekData) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    byMerchant[t.merchant] = (byMerchant[t.merchant] || 0) + t.amount;
  }

  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => ({ category: cat, amount: parseFloat(amt.toFixed(2)), percent: parseFloat((amt / thisTotal * 100).toFixed(1)) }));

  const topMerchants = Object.entries(byMerchant)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([merchant, amt]) => ({ merchant, amount: parseFloat(amt.toFixed(2)) }));

  // Daily average
  const dailyAvg = parseFloat((thisTotal / 7).toFixed(2));

  // Biggest single transaction
  const biggest = thisWeekData.sort((a, b) => b.amount - a.amount)[0];

  return {
    period: `${config.formatDateIN(weekAgo)} to ${config.formatDateIN(today)}`,
    this_week_total: parseFloat(thisTotal.toFixed(2)),
    last_week_total: parseFloat(lastTotal.toFixed(2)),
    change_percent: parseFloat(changePercent.toFixed(1)),
    direction: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'same',
    daily_average: dailyAvg,
    transaction_count: thisWeekData.length,
    top_categories: topCategories,
    top_merchants: topMerchants,
    biggest_transaction: biggest ? { merchant: biggest.merchant, amount: biggest.amount, date: config.formatDateIN(biggest.txn_date) } : null,
  };
}

// --- Salary Detection ---
async function detectSalary(month, userContext) {
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const [yr, mo] = targetMonth.split('-').map(Number);
  const nextMo = mo === 12 ? `${yr + 1}-01-01` : `${yr}-${String(mo + 1).padStart(2, '0')}-01`;

  // Load all transactions for the month (credits + debits) via repository
  // querySpending defaults to 'debit', so we need both types — use two calls
  const { data: debits } = await repos.transactions.querySpending(userContext.userId, {
    type: 'debit', startDate: `${targetMonth}-01`, endDate: nextMo,
  });
  const { data: credits } = await repos.transactions.querySpending(userContext.userId, {
    type: 'credit', startDate: `${targetMonth}-01`, endDate: nextMo,
  });

  const allTxns = [...(credits || []), ...(debits || [])];

  // Find likely salary: credit > ₹10,000 OR large round amounts
  const salaryCredits = (credits || []).filter(t => t.amount >= 10000);

  // Total spending from debits
  const totalSpent = (debits || []).reduce((s, t) => s + t.amount, 0);

  if (salaryCredits.length > 0) {
    const salary = salaryCredits.sort((a, b) => b.amount - a.amount)[0]; // Largest credit is likely salary
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const dayOfMonth = new Date(salary.txn_date).getDate();
    const remainingDays = daysInMonth - new Date().getDate();
    const dailyBudget = remainingDays > 0 ? parseFloat(((salary.amount - totalSpent) / remainingDays).toFixed(2)) : 0;

    return {
      salary_detected: true,
      amount: salary.amount,
      date: config.formatDateIN(salary.txn_date),
      bank: salary.bank,
      total_spent_this_month: parseFloat(totalSpent.toFixed(2)),
      remaining: parseFloat((salary.amount - totalSpent).toFixed(2)),
      remaining_days: remainingDays,
      daily_budget: dailyBudget,
      salary_day_pattern: dayOfMonth <= 5 ? 'early_month' : dayOfMonth <= 15 ? 'mid_month' : 'late_month',
    };
  }

  return {
    salary_detected: false,
    message: `No salary credit found for ${targetMonth}. This could mean salary hasn't arrived yet, or SMS/email data doesn't include credits.`,
    total_spent_this_month: parseFloat(totalSpent.toFixed(2)),
  };
}

// --- Net Worth Calculator ---
async function getNetWorth(userContext) {
  let portfolioValue = 0;
  let mfValue = 0;
  let estimatedBankBalance = 0;

  // Stock portfolio
  const portfolio = await brokers.getPortfolio(userContext.userId);
  if (!portfolio.error) {
    portfolioValue = portfolio.total_value;
  }

  // Mutual funds (if CAS uploaded)
  try {
    const mf = await cas.parseCas(userContext.userId);
    if (!mf.error) {
      mfValue = mf.total_mf_value;
    }
  } catch {}

  // Estimate bank balance: salary - spending this month
  const salary = await detectSalary(null, userContext);
  if (salary.salary_detected) {
    estimatedBankBalance = salary.remaining;
  }

  const totalNetWorth = portfolioValue + mfValue + Math.max(0, estimatedBankBalance);

  // Format for display
  const formatINR = (n) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${n.toLocaleString('en-IN')}`;
  };

  return {
    total_net_worth: parseFloat(totalNetWorth.toFixed(2)),
    total_net_worth_display: formatINR(totalNetWorth),
    breakdown: {
      stocks: { value: portfolioValue, display: formatINR(portfolioValue), connected: !portfolio.error },
      mutual_funds: { value: mfValue, display: formatINR(mfValue), connected: mfValue > 0 },
      bank_balance_estimate: { value: Math.max(0, estimatedBankBalance), display: formatINR(Math.max(0, estimatedBankBalance)), note: 'Estimated from salary - spending' },
    },
    data_sources: [
      !portfolio.error ? 'Zerodha/Angel One' : null,
      mfValue > 0 ? 'CASParser (Mutual Funds)' : null,
      salary.salary_detected ? 'SMS/Email (Bank balance estimate)' : null,
    ].filter(Boolean),
  };
}

// --- Calendar (Kaal Agent) ---
async function getTodaySchedule(userContext) {
  const connected = await calendar.isConnected(userContext.userId);
  if (!connected) {
    return {
      error: 'Google Calendar not connected',
      action: 'Ask the user to connect Google Calendar to see their schedule.',
    };
  }
  try {
    return await calendar.getTodaySchedule(userContext.userId);
  } catch (err) {
    return { error: `Failed to fetch schedule: ${err.message}` };
  }
}

async function getUpcomingEvents(days, userContext) {
  const connected = await calendar.isConnected(userContext.userId);
  if (!connected) {
    return {
      error: 'Google Calendar not connected',
      action: 'Ask the user to connect Google Calendar to see upcoming events.',
    };
  }
  try {
    return await calendar.getUpcomingEvents(userContext.userId, days);
  } catch (err) {
    return { error: `Failed to fetch upcoming events: ${err.message}` };
  }
}

async function getFreeSlots(userContext) {
  const connected = await calendar.isConnected(userContext.userId);
  if (!connected) {
    return {
      error: 'Google Calendar not connected',
      action: 'Ask the user to connect Google Calendar to find free slots.',
    };
  }
  try {
    return await calendar.getFreeSlots(userContext.userId);
  } catch (err) {
    return { error: `Failed to find free slots: ${err.message}` };
  }
}

module.exports = { executeTool };
