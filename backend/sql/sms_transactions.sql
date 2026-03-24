create table if not exists sms_transactions (
  id          bigserial primary key,
  user_id     text not null default 'default_user',
  amount      numeric(12, 2) not null,
  merchant    text not null,
  bank        text,
  type        text not null default 'debit',
  category    text,
  txn_date    date not null,
  source      text not null default 'sms',   -- 'sms' | 'email' | 'both'
  txn_hash    text not null,                  -- dedup key: hash(amount+date+merchant)
  created_at  timestamptz default now(),
  unique (user_id, txn_hash)
);

create index if not exists idx_sms_txns_user_date
  on sms_transactions (user_id, txn_date desc);
