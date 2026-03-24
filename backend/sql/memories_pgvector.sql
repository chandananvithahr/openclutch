-- Run this in Supabase SQL Editor
-- Required for mem0 self-hosted vector memory (DPDP compliant — data stays in Mumbai)

-- 1. Enable pgvector
create extension if not exists vector;

-- 2. Memories table
create table if not exists memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  content    text not null,
  embedding  vector(1536),
  metadata   jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Vector similarity index
create index if not exists memories_embedding_idx
  on memories using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4. User lookup index
create index if not exists memories_user_id_idx on memories (user_id);

-- 5. RLS
alter table memories enable row level security;

create policy "Users see own memories"
  on memories for all
  using (user_id = auth.uid()::text);

-- 6. Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger memories_updated_at
  before update on memories
  for each row execute function update_updated_at();

-- 7. Vector similarity search function (used by facts.js loadFacts)
create or replace function match_memories(
  query_embedding vector(1536),
  match_user_id   text,
  match_count     int     default 5,
  match_threshold float   default 0.70
)
returns table(id uuid, content text, metadata jsonb, similarity float)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from memories
  where user_id = match_user_id
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
