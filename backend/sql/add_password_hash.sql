-- Add password_hash column to user_profiles for self-service auth
-- Run this in Supabase SQL Editor BEFORE deploying the new auth routes.
-- If user_profiles table doesn't exist yet, run user_profiles.sql first.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Index on email for fast login lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles (email);

-- Ensure email uniqueness (if not already enforced)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_email_unique'
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_email_unique UNIQUE (email);
  END IF;
END $$;
