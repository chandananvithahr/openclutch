// Load .env from backend folder (local dev) — Railway/cloud uses env vars directly
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Fail fast — dns.toys pattern: crash at startup if required keys are missing
const REQUIRED_ENV = ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    // Use console.error here — logger not yet importable (circular dep risk)
    console.error(`[FATAL] Missing required env var: ${key}. Check your .env file.`);
    process.exit(1);
  }
}

const express           = require('express');
const cors              = require('cors');
const helmet            = require('helmet');
const logger            = require('./lib/logger');
const config            = require('./lib/config');
const { errorMiddleware } = require('./middleware/errors');
const { rateLimitMiddleware } = require('./middleware/rateLimit');
const { authMiddleware } = require('./middleware/auth');

// Routes
const authRoutes     = require('./routes/auth');
const chatRoutes     = require('./routes/chat');
const zerodhaRoutes  = require('./routes/zerodha');
const angeloneRoutes = require('./routes/angelone');
const upstoxRoutes   = require('./routes/upstox');
const fyersRoutes    = require('./routes/fyers');
const dhanRoutes      = require('./routes/dhan');
const fivepaisaRoutes = require('./routes/fivepaisa');
const gmailRoutes    = require('./routes/gmail');
const calendarRoutes = require('./routes/calendar');
const whatsappRoutes = require('./routes/whatsapp');
const casRoutes      = require('./routes/cas');
const smsRoutes      = require('./routes/sms');
const journalRoutes   = require('./routes/journal');
const careerRoutes    = require('./routes/career');
const healthRoutes    = require('./routes/health');
const workflowRoutes     = require('./routes/workflows');
const onboardingRoutes   = require('./routes/onboarding');
const filesRoutes        = require('./routes/files');
const driveRoutes        = require('./routes/drive');

// Workflow registry + scheduler (registers all workflows in engine)
const { scheduler }   = require('./workflows');

const app = express();

// CORS — restrict to known origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : config.CORS.DEFAULT_ORIGINS;

// Security headers — helmet sets X-Frame-Options, X-Content-Type-Options, HSTS, etc.
app.use(helmet());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
}));

app.use(express.json({ limit: '1mb' }));

// JWT auth — verify token on all /api/* routes (public paths exempt — see middleware/auth.js)
app.use(authMiddleware);

// Global rate limit — 20 req/min per user across ALL routes
app.use('/api', rateLimitMiddleware);

// Real health check — actually pings Supabase
app.get('/health', async (req, res) => {
  const supabase = require('./lib/supabase');
  const { error } = await supabase.from('messages').select('id').limit(1);
  res.json({
    status: error ? 'degraded' : 'ok',
    app:    'Clutch Backend',
    db:     error ? `error: ${error.message}` : 'connected',
  });
});

app.use('/api/auth',      authRoutes);
app.use('/api/chat',      chatRoutes);
app.use('/api/zerodha',   zerodhaRoutes);
app.use('/api/angelone',  angeloneRoutes);
app.use('/api/upstox',    upstoxRoutes);
app.use('/api/fyers',     fyersRoutes);
app.use('/api/dhan',      dhanRoutes);
app.use('/api/fivepaisa', fivepaisaRoutes);
app.use('/api/gmail',     gmailRoutes);
app.use('/api/calendar',  calendarRoutes);
app.use('/api/whatsapp',  whatsappRoutes);
app.use('/api/cas',       casRoutes);
app.use('/api/sms',       smsRoutes);
app.use('/api/journal',    journalRoutes);
app.use('/api/career',     careerRoutes);
app.use('/api/health',     healthRoutes);
app.use('/api/workflows',  workflowRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/files',     filesRoutes);
app.use('/api/drive',     driveRoutes);

// Centralized error handler — listmonk pattern (must be last)
app.use(errorMiddleware);

// Start
const PORT   = config.PORT;
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info('Clutch backend started', { port: PORT, env: process.env.NODE_ENV || 'development' });

  // Start background workflow scheduler
  // getUserIds: in production this should query active users from Supabase.
  // Placeholder: reads SCHEDULER_USER_IDS env var (comma-separated) or falls back to empty.
  const userIds = (process.env.SCHEDULER_USER_IDS || '').split(',').filter(Boolean);
  if (userIds.length) {
    scheduler.start(() => userIds);
    logger.info('Scheduler started', { userIds: userIds.length });
  } else {
    logger.info('Scheduler idle — set SCHEDULER_USER_IDS env var to enable background sync');
  }
});

// Graceful shutdown — close server before process exits
// Prevents dropped requests on Railway/Heroku deploys
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  scheduler.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force-kill after 10 seconds if connections hang
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Log unhandled promise rejections instead of silently crashing
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
