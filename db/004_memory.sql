alter table users
  add column if not exists memory_enabled boolean not null default true;

create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  scope text not null check (scope in ('saved', 'project')),
  kind text not null default 'fact' check (kind in ('fact', 'preference', 'instruction', 'knowledge')),
  label text not null default '',
  content text not null,
  source_conversation_id uuid references conversations(id) on delete set null,
  importance smallint not null default 3 check (importance between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'saved' and project_id is null) or (scope = 'project' and project_id is not null))
);

create index if not exists memories_user_scope_updated_idx
  on memories(user_id, scope, updated_at desc);
create index if not exists memories_project_updated_idx
  on memories(project_id, updated_at desc);
create index if not exists memories_search_idx
  on memories using gin (to_tsvector('simple', coalesce(label, '') || ' ' || content));

create table if not exists memory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  memory_id uuid,
  action text not null check (action in ('create', 'update', 'delete', 'read')),
  created_at timestamptz not null default now()
);
create index if not exists memory_events_user_created_idx
  on memory_events(user_id, created_at desc);

create table if not exists conversation_context (
  conversation_id uuid primary key references conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  summary text not null default '',
  key_topics text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index if not exists conversation_context_user_updated_idx
  on conversation_context(user_id, updated_at desc);
