// Centralized error handling — listmonk pattern
// Handlers throw HTTPError; this middleware catches and formats consistently

'use strict';

const logger = require('../lib/logger');

class HTTPError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'HTTPError';
  }
}

// Wrap async route handlers so uncaught errors flow to errorMiddleware
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Express error middleware (must have 4 args)
function errorMiddleware(err, req, res, next) {
  const status  = err.status || 500;
  const message = err.status ? err.message : 'Something went wrong. Try again.';

  if (!err.status) {
    // Unexpected error — log full details for debugging
    logger.error(`Unhandled error [${req.method}] ${req.path}`, {
      err:    err.message,
      stack:  err.stack,
    });
  }

  res.status(status).json({ error: message });
}

module.exports = { HTTPError, asyncHandler, errorMiddleware };
