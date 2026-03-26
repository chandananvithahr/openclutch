-- Persistent rate limiting table for multi-instance Railway deployment
-- The rate limiter syncs in-memory state to this table every 5th request.
-- On deploy/restart, it resumes from the last known window.

CREATE TABLE IF NOT EXISTS rate_limits (
  user_id TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-cleanup: delete windows older than 10 minutes (cron or manual)
-- Supabase doesn't have native cron, so the cleanup runs in-memory on the server.
-- This index makes the cleanup fast if you add a Supabase pg_cron job later:
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);

-- RLS: rate_limits is server-side only (service_role key), no user access
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No RLS policies = only service_role can access (correct for server-side rate limiting)
