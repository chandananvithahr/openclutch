// Exponential backoff — kiteconnectjs ticker.ts pattern
// Powers all broker API retries in the project

'use strict';

const DEFAULT = {
  initialDelay: 1000,   // 1s
  maxDelay: 30000,      // 30s cap
  maxRetries: 5,
  multiplier: 2,
};

// Compute delay for attempt N (0-indexed)
function backoffDelay(attempt, opts = {}) {
  const { initialDelay, maxDelay, multiplier } = { ...DEFAULT, ...opts };
  const delay = initialDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry an async fn with exponential backoff
// shouldRetry(err) — return false to stop immediately (e.g. auth errors)
async function withRetry(fn, opts = {}) {
  const { maxRetries, shouldRetry } = { ...DEFAULT, ...opts };

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (shouldRetry && !shouldRetry(err)) throw err;
      if (attempt === maxRetries) break;
      const delay = backoffDelay(attempt, opts);
      console.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms — ${err.message}`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

module.exports = { withRetry, backoffDelay, sleep };
