-- Chitta Agent — Daily Journaling
-- Stores journal entries with AI-detected mood and cross-agent links

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default_user',
  content TEXT NOT NULL,
  mood TEXT,  -- happy, stressed, anxious, motivated, tired, neutral, sad, excited
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
  tags TEXT[],  -- AI-extracted tags like ['work', 'health', 'money']
  linked_spending NUMERIC(10,2),  -- total spending that day (auto-filled)
  linked_sleep_hours NUMERIC(4,1),  -- sleep data if available
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user + date
CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries(user_id, entry_date DESC);

-- Unique constraint: one journal entry per user per day (upsert pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_user_day ON journal_entries(user_id, entry_date);
