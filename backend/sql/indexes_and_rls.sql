-- Performance indexes + RLS enforcement for Clutch
-- Run this in Supabase SQL Editor AFTER all tables are created
-- Idempotent — safe to run multiple times
--
-- NOTE: Each table's .sql file now includes its own RLS policy.
-- This file serves as a SAFETY NET — ensures RLS is enabled even if
-- individual files were run without their RLS sections.
-- Also adds cross-table performance indexes not in individual files.

-- =============================================
-- STEP 1: ENABLE RLS ON ALL TABLES
-- This is the critical security fix.
-- Backend uses service_role key (bypasses RLS) — this won't break anything.
-- This blocks anon key from reading data directly.
-- =============================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_transactions ENABLE ROW LEVEL SECURITY;

-- These tables may not exist yet — wrap in DO block
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    EXECUTE 'ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    EXECUTE 'ALTER TABLE notifications ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
    EXECUTE 'ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'health_data') THEN
    EXECUTE 'ALTER TABLE health_data ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'career_profiles') THEN
    EXECUTE 'ALTER TABLE career_profiles ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_applications') THEN
    EXECUTE 'ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memories') THEN
    EXECUTE 'ALTER TABLE memories ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- =============================================
-- STEP 2: RLS POLICIES — users see only their own rows
-- Uses auth.uid() for Supabase Auth compatibility
-- service_role key bypasses these (backend keeps working)
-- =============================================

-- Helper: create policy if not exists
-- (each policy name is unique per table to avoid conflicts with inline .sql policies)

-- messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'messages_user_isolation') THEN
    CREATE POLICY messages_user_isolation ON messages FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- connected_apps (contains OAuth tokens — most critical table)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'connected_apps' AND policyname = 'apps_user_isolation') THEN
    CREATE POLICY apps_user_isolation ON connected_apps FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- user_facts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_facts' AND policyname = 'facts_user_isolation') THEN
    CREATE POLICY facts_user_isolation ON user_facts FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- sms_transactions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_transactions' AND policyname = 'sms_user_isolation') THEN
    CREATE POLICY sms_user_isolation ON sms_transactions FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- user_profiles
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'profiles_user_isolation') THEN
    CREATE POLICY profiles_user_isolation ON user_profiles FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- notifications
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_user_isolation') THEN
    CREATE POLICY notifications_user_isolation ON notifications FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- journal_entries
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'journal_user_isolation') THEN
    CREATE POLICY journal_user_isolation ON journal_entries FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- health_data
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'health_data')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_data' AND policyname = 'health_user_isolation') THEN
    CREATE POLICY health_user_isolation ON health_data FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- career_profiles
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'career_profiles')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'career_profiles' AND policyname = 'career_user_isolation') THEN
    CREATE POLICY career_user_isolation ON career_profiles FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- job_applications
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_applications')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_applications' AND policyname = 'jobs_user_isolation') THEN
    CREATE POLICY jobs_user_isolation ON job_applications FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- =============================================
-- STEP 3: PERFORMANCE INDEXES
-- =============================================

-- sms_transactions: most queried (monthly/weekly spending, salary detect)
CREATE INDEX IF NOT EXISTS idx_sms_user_date ON sms_transactions (user_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_sms_user_type_date ON sms_transactions (user_id, type, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_sms_user_hash ON sms_transactions (user_id, txn_hash);
CREATE INDEX IF NOT EXISTS idx_sms_category ON sms_transactions (user_id, category, txn_date DESC);

-- messages: chat history load
CREATE INDEX IF NOT EXISTS idx_messages_user_ts ON messages (user_id, created_at DESC);

-- user_facts: fact lookup
CREATE INDEX IF NOT EXISTS idx_facts_user_key ON user_facts (user_id, fact_key);

-- connected_apps: token lookup on every request
CREATE INDEX IF NOT EXISTS idx_apps_user_name ON connected_apps (user_id, app_name);

-- Conditional indexes for tables that may not exist yet
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries (user_id, entry_date DESC)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'health_data') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_health_user_date ON health_data (user_id, entry_date DESC)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_applications') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_user_date ON job_applications (user_id, applied_date DESC)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications (user_id, read, created_at DESC)';
  END IF;
END $$;
