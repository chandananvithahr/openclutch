-- Arogya Agent — Health & Fitness
-- Stores daily health metrics from Health Connect (Android) / HealthKit (iOS)

CREATE TABLE IF NOT EXISTS health_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  entry_date DATE NOT NULL,
  steps INTEGER,
  sleep_hours NUMERIC(4,1),
  heart_rate_avg INTEGER,
  heart_rate_min INTEGER,
  heart_rate_max INTEGER,
  calories_burned INTEGER,
  active_minutes INTEGER,
  weight NUMERIC(5,1),  -- kg
  source TEXT DEFAULT 'health_connect',  -- health_connect, healthkit, manual
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_health_user_date ON health_data(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_health_lookup ON health_data(user_id, entry_date DESC);

-- RLS: users can only access their own health data
ALTER TABLE health_data ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'health_data' AND policyname = 'health_user_isolation'
  ) THEN
    CREATE POLICY health_user_isolation ON health_data
      FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;
