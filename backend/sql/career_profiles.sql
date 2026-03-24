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
  user_id TEXT NOT NULL DEFAULT 'default_user',
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
