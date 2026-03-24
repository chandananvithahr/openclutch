// Structured logger — zero new dependencies, replaces scattered console.log/error calls.
// Format: [ISO-TIMESTAMP] [LEVEL] message ...args
// Level controlled by LOG_LEVEL env var (error | warn | info | debug). Default: info.
//
// Usage:
//   const logger = require('../lib/logger');
//   logger.info('Server started', { port: 3000 });
//   logger.error('Tool failed', { tool: 'get_portfolio', err: err.message });

'use strict';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;
const IS_PROD = process.env.NODE_ENV === 'production';

function log(level, message, meta) {
  if (LEVELS[level] > currentLevel) return;

  const ts = new Date().toISOString();

  if (IS_PROD) {
    // Production: structured JSON — easy for log aggregators (Railway, Datadog)
    const entry = { ts, level, message };
    if (meta !== undefined) entry.meta = meta;
    if (level === 'error') {
      process.stderr.write(JSON.stringify(entry) + '\n');
    } else {
      process.stdout.write(JSON.stringify(entry) + '\n');
    }
  } else {
    // Development: readable format
    const prefix = `[${ts}] [${level.toUpperCase().padEnd(5)}]`;
    const metaStr = meta !== undefined ? ' ' + JSON.stringify(meta) : '';
    if (level === 'error' || level === 'warn') {
      console.error(prefix, message + metaStr);
    } else {
      console.log(prefix, message + metaStr);
    }
  }
}

const logger = {
  error: (message, meta) => log('error', message, meta),
  warn:  (message, meta) => log('warn',  message, meta),
  info:  (message, meta) => log('info',  message, meta),
  debug: (message, meta) => log('debug', message, meta),

  // Convenience: log HTTP request completion (use in route handlers)
  request: (method, path, status, durationMs) =>
    log('info', `${method} ${path} ${status}`, { ms: durationMs }),
};

module.exports = logger;
