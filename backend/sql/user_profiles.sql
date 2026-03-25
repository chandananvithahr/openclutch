-- Onboarding — User Profile Data
-- Stores all data collected during Cleo-style onboarding flow
-- Feeds into chat.js system prompt for personalized AI responses

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  age INTEGER,
  city TEXT,
  mobile TEXT,
  email TEXT,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  occupation TEXT CHECK (occupation IN ('student', 'working')),
  -- Student fields
  college TEXT,
  field_of_study TEXT,
  study_year INTEGER,
  job_feature_enabled BOOLEAN DEFAULT false,
  -- Working fields
  annual_ctc NUMERIC,
  monthly_emi NUMERIC,
  company TEXT,
  role TEXT,
  -- Lifestyle
  fitness_active BOOLEAN DEFAULT false,
  has_fitness_tracker BOOLEAN DEFAULT false,
  tracker_type TEXT,
  -- Savings & Assets
  savings_methods TEXT[] DEFAULT '{}',   -- ['mf', 'stocks', 'gold', 'fd']
  owns_car BOOLEAN DEFAULT false,
  owns_bike BOOLEAN DEFAULT false,
  owns_house BOOLEAN DEFAULT false,
  -- Priorities
  domain_priorities TEXT[] DEFAULT '{}', -- ['money', 'career', 'health', 'mind']
  -- Tone preference
  tone TEXT DEFAULT 'pro' CHECK (tone IN ('bhai', 'pro', 'mentor')),
  -- Meta
  profile_completeness INTEGER DEFAULT 0,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON user_profiles(user_id);

-- RLS: users can only access their own profile
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'profiles_user_isolation'
  ) THEN
    CREATE POLICY profiles_user_isolation ON user_profiles
      FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- Auto-update updated_at on profile changes
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON user_profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_updated_at();
