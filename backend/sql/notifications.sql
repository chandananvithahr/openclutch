-- Notifications table
-- Stores in-app notifications for all agents (Artha, Vriddhi, Chitta, Karma, Arogya).
-- Mobile polls GET /api/workflows/notifications to display the bell icon + list.

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  type        text        NOT NULL,   -- spending_alert | portfolio_change | new_transactions | health_alert | weekly_review | daily_digest | workflow_error | job_update | salary_detected
  message     text        NOT NULL,
  data        jsonb,                  -- structured payload per type
  priority    text        NOT NULL DEFAULT 'normal',  -- low | normal | high
  read        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup: user's unread, newest first
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, read, created_at DESC);

-- Cleanup old notifications (keep 90 days)
CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON notifications (created_at);

-- RLS: users can only see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_user_isolation'
  ) THEN
    CREATE POLICY notifications_user_isolation ON notifications
      FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;
