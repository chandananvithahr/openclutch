// Workflow HTTP API
//
// GET  /api/workflows              — list registered workflows
// POST /api/workflows/trigger/:name — manually trigger a workflow
// GET  /api/notifications          — load user notifications
// POST /api/notifications/read     — mark notifications as read
// POST /api/notifications/read-all — mark all as read
// GET  /api/notifications/unread   — unread count

'use strict';

const express          = require('express');
const { runWorkflow, listWorkflows } = require('../workflows/engine');
const {
  loadNotifications,
  markRead,
  markAllRead,
  unreadCount,
}                      = require('../workflows/notifications');
const logger           = require('../lib/logger');
const { asyncHandler, HTTPError } = require('../middleware/errors');

const router = express.Router();

// Workflows that accept manual triggers and their required input fields
const TRIGGERABLE = {
  emailSync:     [],                     // no extra input required
  portfolioSync: [],
  weeklyReview:  [],
  smsIngestion:  ['transactions'],       // requires body.transactions
  healthSync:    ['metrics'],            // requires body.metrics
};

// ─── Workflow routes ──────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  res.json({ workflows: listWorkflows() });
});

router.post('/trigger/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const userId = req.userId;

  if (!TRIGGERABLE[name]) {
    throw new HTTPError(404, `Unknown or non-triggerable workflow: ${name}`);
  }

  const required = TRIGGERABLE[name];
  for (const field of required) {
    if (req.body[field] === undefined) {
      throw new HTTPError(400, `Missing required field: ${field}`);
    }
  }

  const input = { userId, ...req.body };

  logger.info('workflows:manualTrigger', { name, userId });

  // Short workflows: wait for result so mobile gets immediate feedback
  const SHORT_WORKFLOWS = ['smsIngestion', 'healthSync'];
  if (SHORT_WORKFLOWS.includes(name)) {
    const result = await runWorkflow(name, input);
    return res.json({ triggered: name, success: result._success, durationMs: result._durationMs });
  }

  // Long workflows (email, portfolio, weekly): fire-and-forget
  runWorkflow(name, input).catch(err => {
    logger.error('workflows:manualTrigger failed', { name, userId, err: err.message });
  });
  res.json({ triggered: name, queued: true });
}));

// ─── Notification routes ──────────────────────────────────────────────────────

router.get('/notifications', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const limit     = parseInt(req.query.limit || '20', 10);
  const unreadOnly = req.query.unread === 'true';

  const { notifications, error } = await loadNotifications(userId, limit, unreadOnly);
  if (error) throw new HTTPError(500, error);

  res.json({ notifications });
}));

router.get('/notifications/unread', asyncHandler(async (req, res) => {
  const userId = req.userId;

  const count = await unreadCount(userId);
  res.json({ unread: count });
}));

router.post('/notifications/read', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { ids } = req.body;
  if (!Array.isArray(ids)) throw new HTTPError(400, 'ids must be an array');

  await markRead(userId, ids);
  res.json({ ok: true });
}));

router.post('/notifications/read-all', asyncHandler(async (req, res) => {
  const userId = req.userId;

  await markAllRead(userId);
  res.json({ ok: true });
}));

module.exports = router;
