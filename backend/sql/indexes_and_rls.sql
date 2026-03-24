-- Performance indexes + RLS policies for OpenClutch
-- Run this in Supabase SQL Editor after all tables are created
-- One-time setup — idempotent (CREATE INDEX IF NOT EXISTS + DO blocks for RLS)

-- =============================================
-- INDEXES — query performance
-- =============================================

-- sms_transactions: most queried table (monthly/weekly spending, salary detect)
CREATE INDEX IF NOT EXISTS idx_sms_user_date
  ON sms_transactions (user_id, txn_date DESC);

CREATE INDEX IF NOT EXISTS idx_sms_user_type_date
  ON sms_transactions (user_id, type, txn_date DESC);

CREATE INDEX IF NOT EXISTS idx_sms_user_hash
  ON sms_transactions (user_id, txn_hash);

CREATE INDEX IF NOT EXISTS idx_sms_category
  ON sms_transactions (user_id, category, txn_date DESC);

-- messages: chat history load
CREATE INDEX IF NOT EXISTS idx_messages_user_ts
  ON messages (user_id, created_at DESC);

-- user_facts: fact lookup by user
CREATE INDEX IF NOT EXISTS idx_facts_user_key
  ON user_facts (user_id, fact_key);

-- journal_entries: mood timeline queries
CREATE INDEX IF NOT EXISTS idx_journal_user_date
  ON journal_entries (user_id, entry_date DESC);

-- health_data: health summary queries
CREATE INDEX IF NOT EXISTS idx_health_user_date
  ON health_data (user_id, entry_date DESC);

-- job_applications: application tracker
CREATE INDEX IF NOT EXISTS idx_jobs_user_date
  ON job_applications (user_id, applied_date DESC);

-- connected_apps: token lookup (happens on every startup)
CREATE INDEX IF NOT EXISTS idx_apps_user_name
  ON connected_apps (user_id, app_name);

-- =============================================
-- ROW LEVEL SECURITY — production safety
-- Run these AFTER enabling RLS on each table
-- =============================================

-- Enable RLS on all tables
ALTER TABLE sms_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_apps ENABLE ROW LEVEL SECURITY;

-- NOTE: We use service_role key on the backend (bypasses RLS)
-- These policies protect against direct Supabase client access from mobile
-- All backend routes use service_role → full access

-- Allow service_role to bypass (already the default — just documenting)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- For anon/authenticated users: only access their own rows
-- (Currently unused since all user_id = 'default_user' — enable when multi-user)

-- sms_transactions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sms_transactions' AND policyname = 'own_rows'
  ) THEN
    CREATE POLICY own_rows ON sms_transactions
      USING (user_id = current_setting('app.user_id', true));
  END IF;
END $$;

-- messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'own_rows'
  ) THEN
    CREATE POLICY own_rows ON messages
      USING (user_id = current_setting('app.user_id', true));
  END IF;
END $$;

-- user_facts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_facts' AND policyname = 'own_rows'
  ) THEN
    CREATE POLICY own_rows ON user_facts
      USING (user_id = current_setting('app.user_id', true));
  END IF;
END $$;

-- journal_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'own_rows'
  ) THEN
    CREATE POLICY own_rows ON journal_entries
      USING (user_id = current_setting('app.user_id', true));
  END IF;
END $$;

-- health_data
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'health_data' AND policyname = 'own_rows'
  ) THEN
    CREATE POLICY own_rows ON health_data
      USING (user_id = current_setting('app.user_id', true));
  END IF;
END $$;

-- career_profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'career_profiles' AND policyname = 'own_rows'
  ) THEN
    CREATE POLICY own_rows ON career_profiles
      USING (user_id = current_setting('app.user_id', true));
  END IF;
END $$;

-- job_applications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_applications' AND policyname = 'own_rows'
  ) THEN
    CREATE POLICY own_rows ON job_applications
      USING (user_id = current_setting('app.user_id', true));
  END IF;
END $$;

-- connected_apps
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'connected_apps' AND policyname = 'own_rows'
  ) THEN
    CREATE POLICY own_rows ON connected_apps
      USING (user_id = current_setting('app.user_id', true));
  END IF;
END $$;
