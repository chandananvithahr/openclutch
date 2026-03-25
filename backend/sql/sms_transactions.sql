-- Artha Agent — Bank SMS + Email Transaction Tracking
-- Stores parsed transactions from bank SMS and Gmail alerts
-- Dedup via txn_hash (amount+date+merchant) — same txn never double-counted

CREATE TABLE IF NOT EXISTS sms_transactions (
  id          bigserial PRIMARY KEY,
  user_id     text NOT NULL DEFAULT 'default_user',
  amount      numeric(12, 2) NOT NULL,
  merchant    text NOT NULL,
  bank        text,
  type        text NOT NULL DEFAULT 'debit',
  category    text,
  txn_date    date NOT NULL,
  source      text NOT NULL DEFAULT 'sms',   -- 'sms' | 'email' | 'both'
  txn_hash    text NOT NULL,                  -- dedup key: hash(amount+date+merchant)
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, txn_hash)
);

CREATE INDEX IF NOT EXISTS idx_sms_txns_user_date
  ON sms_transactions (user_id, txn_date DESC);

-- RLS: users can only access their own transactions
ALTER TABLE sms_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sms_transactions' AND policyname = 'sms_user_isolation'
  ) THEN
    CREATE POLICY sms_user_isolation ON sms_transactions
      FOR ALL USING (user_id = auth.uid()::text);
  END IF;
END $$;
