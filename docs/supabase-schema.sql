-- OpenClutch Database Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query

-- Messages (chat history)
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  user_id text not null default 'default_user',
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tone text default 'pro',
  created_at timestamp with time zone default now()
);

-- Connected apps (broker tokens, Gmail tokens etc.)
create table if not exists connected_apps (
  id uuid default gen_random_uuid() primary key,
  user_id text not null default 'default_user',
  app_name text not null,
  access_token text not null,
  updated_at timestamp with time zone default now(),
  unique(user_id, app_name)
);

-- Screen captures from accessibility service
create table if not exists screen_captures (
  id uuid default gen_random_uuid() primary key,
  user_id text not null default 'default_user',
  app_name text not null,
  text text not null,
  captured_at timestamp with time zone default now()
);

-- Long-term user facts (Tier 3 memory)
-- Stores extracted facts like "purdue_scholarship = $6,000", "admitted_to = Purdue"
create table if not exists user_facts (
  id uuid default gen_random_uuid() primary key,
  user_id text not null default 'default_user',
  category text not null check (category in ('education', 'finance', 'portfolio', 'email', 'personal', 'career')),
  key text not null,
  value text not null,
  updated_at timestamp with time zone default now(),
  unique(user_id, key)
);

-- Index for fast message retrieval per user
create index if not exists messages_user_id_idx on messages(user_id, created_at desc);
create index if not exists screen_captures_user_id_idx on screen_captures(user_id, captured_at desc);
create index if not exists user_facts_user_id_idx on user_facts(user_id, updated_at desc);
