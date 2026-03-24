// Centralized configuration — single source of truth
// All magic numbers, limits, and tuneable values live here.
// No process.env reads scattered in business logic — only here and lib/supabase.js/ai.js.

'use strict';

module.exports = {
  // Server
  PORT: parseInt(process.env.PORT || '3000', 10),

  // AI model
  MODEL: 'gpt-4o-mini',
  MAX_MESSAGES_PER_REQUEST: 100,   // Hard cap on incoming message array size
  MAX_MESSAGES_TO_LLM: 50,        // Slice before sending to OpenAI

  // Tone system
  VALID_TONES: ['bhai', 'pro', 'mentor'],

  // Memory tiers
  MEMORY: {
    KEEP_VERBATIM: 8,        // Tier 1: last N messages sent in full
    SUMMARIZE_AFTER: 14,     // Tier 2: summarize when history exceeds this
    SUMMARY_MAX_TOKENS: 150, // Tier 2: summary length budget
    FACTS_HISTORY_LIMIT: 100, // Tier 3: max facts to load per request
  },

  // Cache TTLs (milliseconds)
  TTL: {
    PORTFOLIO: 5 * 60 * 1000,           // 5 min — broker holdings
    STOCK_PRICE: 2 * 60 * 1000,         // 2 min — live prices (Yahoo Finance)
    FINANCIALS: 24 * 60 * 60 * 1000,    // 24 hr — screener.in annual data
    SPENDING: 10 * 60 * 1000,           // 10 min — SMS/email transactions
  },

  // Rate limiting (per user, sliding window)
  RATE_LIMIT: {
    WINDOW_MS: 60 * 1000,  // 1 minute window
    MAX_REQUESTS: 20,       // 20 AI calls per minute
    CLEANUP_INTERVAL: 5 * 60 * 1000, // Prune stale windows every 5 min
  },

  // Chat history
  HISTORY: {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 200,
  },

  // File uploads (CAS PDF, resume)
  UPLOAD: {
    RESUME_TEXT_MAX: 3000,   // chars sent to LLM for resume parsing
    RESUME_STORE_MAX: 5000,  // chars stored in DB
    MAX_JOB_DESC: 2000,      // chars of JD sent to job fit scorer
  },

  // Spending / SMS
  SPENDING: {
    EMAIL_LOOKBACK_DAYS: 60,   // How far back to search Gmail for bank emails
    MAX_EMAIL_BATCH: 100,      // Gmail batch size for transaction sync
    MAX_JOB_EMAILS: 20,        // Gmail batch size for job email search
    RECENT_TXNS_LIMIT: 20,     // /api/sms/recent default
    APPLICATIONS_LIMIT: 50,    // /api/career/applications default
  },

  // Embeddings (Tier 3 memory)
  EMBED_MODEL: 'text-embedding-3-small',    // 1536 dims, cheap
  SIMILARITY_THRESHOLD: 0.70,
  SIMILARITY_TOP_K: 5,

  // CORS
  CORS: {
    DEFAULT_ORIGINS: ['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:3000'],
  },
};
