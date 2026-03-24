-- Arogya Agent — Health & Fitness
-- Stores daily health metrics from Health Connect (Android)

CREATE TABLE IF NOT EXISTS health_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default_user',
  entry_date DATE NOT NULL,
  steps INTEGER,
  sleep_hours NUMERIC(4,1),
  heart_rate_avg INTEGER,
  heart_rate_min INTEGER,
  heart_rate_max INTEGER,
  calories_burned INTEGER,
  active_minutes INTEGER,
  weight NUMERIC(5,1),  -- kg
  source TEXT DEFAULT 'health_connect',  -- health_connect, manual, google_fit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_health_user_date ON health_data(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_health_lookup ON health_data(user_id, entry_date DESC);
