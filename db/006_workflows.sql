create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  title text not null,
  request text not null,
  workflow_type text not null check (workflow_type in ('research','create','build','analyze','plan','general')),
  status text not null default 'queued' check (status in ('queued','running','verifying','completed','failed','cancelled')),
  plan jsonb not null default '[]'::jsonb,
  result_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  step_order integer not null,
  title text not null,
  kind text not null check (kind in ('understand','research','execute','verify','deliver')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','skipped')),
  tool_names text[] not null default '{}',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  unique(workflow_id, step_order)
);

create index if not exists workflows_user_updated_idx on workflows(user_id, updated_at desc);
create index if not exists workflows_project_updated_idx on workflows(project_id, updated_at desc);
create index if not exists workflows_conversation_updated_idx on workflows(conversation_id, updated_at desc);
create index if not exists workflow_steps_workflow_order_idx on workflow_steps(workflow_id, step_order);
