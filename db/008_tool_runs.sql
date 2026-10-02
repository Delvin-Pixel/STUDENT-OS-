create table if not exists tool_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  tool_name text not null,
  status text not null check (status in ('success', 'error')),
  duration_ms integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists tool_runs_user_created_idx
  on tool_runs (user_id, created_at desc);

create index if not exists tool_runs_project_created_idx
  on tool_runs (project_id, created_at desc)
  where project_id is not null;
