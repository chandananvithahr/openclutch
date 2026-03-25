// Workflow Scheduler — DeerFlow2 periodic trigger pattern
//
// Runs background workflows on a cron-like schedule using setInterval.
// DeerFlow2 equivalent: TaskManager + ScheduledTask pattern.
//
// Schedule:
//   emailSync      — every 30 min
//   portfolioSync  — every 15 min (market hours only, 09:00–15:30 IST Mon-Fri)
//   weeklyReview   — Sundays at 09:00 IST
//
// Usage (called once in server.js):
//   const scheduler = require('./workflows/scheduler');
//   scheduler.start(userIds);   // pass active user IDs to schedule for

'use strict';

const { runWorkflow }  = require('./engine');
const logger           = require('../lib/logger');

// ─── IST helpers ─────────────────────────────────────────────────────────────

function nowIST() {
  // Returns current time as a Date adjusted to IST (UTC+5:30)
  const utc = new Date();
  return new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
}

function isMarketHours() {
  const ist = nowIST();
  const day = ist.getDay();   // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const h = ist.getHours();
  const m = ist.getMinutes();
  const t = h * 60 + m;
  return t >= 9 * 60 && t <= 15 * 60 + 30;
}

// Only fires in the first minute of 09:00 IST to avoid re-triggering every check
function isSundayMorning() {
  const ist = nowIST();
  return ist.getDay() === 0 && ist.getHours() === 9 && ist.getMinutes() < 5;
}

// ─── Interval references (for clean shutdown) ─────────────────────────────────

const intervals = [];

// ─── Dispatch helper ─────────────────────────────────────────────────────────

async function dispatchForAllUsers(workflowName, userIds) {
  if (!userIds?.length) return;

  for (const userId of userIds) {
    try {
      await runWorkflow(workflowName, { userId });
    } catch (err) {
      logger.error(`scheduler:${workflowName} failed for user`, { userId, err: err.message });
    }
  }
}

// ─── Schedule definitions ─────────────────────────────────────────────────────

const SCHEDULES = [
  {
    name:     'emailSync',
    interval: 30 * 60 * 1000,   // 30 min
    guard:    null,              // always run
  },
  {
    name:     'portfolioSync',
    interval: 15 * 60 * 1000,   // 15 min
    guard:    isMarketHours,     // only during NSE market hours
  },
  {
    name:     'weeklyReview',
    interval: 60 * 60 * 1000,   // check every hour, but fire only on Sunday 09:xx IST
    guard:    isSundayMorning,
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

let _started = false;

function start(getUserIds) {
  if (_started) {
    logger.warn('scheduler: already started — ignoring duplicate start()');
    return;
  }
  _started = true;

  for (const schedule of SCHEDULES) {
    const id = setInterval(async () => {
      if (schedule.guard && !schedule.guard()) return;

      const userIds = typeof getUserIds === 'function' ? await getUserIds() : getUserIds;
      logger.info(`scheduler: firing ${schedule.name}`, { userCount: userIds?.length ?? 0 });
      await dispatchForAllUsers(schedule.name, userIds);
    }, schedule.interval);

    intervals.push(id);
    logger.info(`scheduler: registered ${schedule.name}`, { intervalMs: schedule.interval });
  }

  logger.info('scheduler: started', { workflows: SCHEDULES.map(s => s.name) });
}

function stop() {
  for (const id of intervals) clearInterval(id);
  intervals.length = 0;
  _started = false;
  logger.info('scheduler: stopped');
}

module.exports = { start, stop };
