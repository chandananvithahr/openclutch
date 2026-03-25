-- Karma Agent — Career & Jobs
-- Stores parsed resume data and job application tracking

CREATE TABLE IF NOT EXISTS career_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role_title TEXT,
  experience_years NUMERIC(4,1),
  skills TEXT[],
  education TEXT[],
  work_history JSONB,  -- [{company, role, duration, highlights}]
  raw_resume_text TEXT,
  ats_score INTEGER,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'applied',  -- applied, replied, interview, offer, rejected
  source TEXT,  -- naukri, linkedin, gmail, manual
  applied_date DATE DEFAULT CURRENT_DATE,
  salary_range TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_user ON job_applications(user_id, applied_date DESC);

-- RLS: users can only access their own career data
ALTER TABLE career_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'career_profiles' AND policyname = 'career_user_isolation'
  ) THEN
    CREATE POLICY career_user_isolation ON career_profiles
      FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_applications' AND policyname = 'jobs_user_isolation'
  ) THEN
    CREATE POLICY jobs_user_isolation ON job_applications
      FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;
