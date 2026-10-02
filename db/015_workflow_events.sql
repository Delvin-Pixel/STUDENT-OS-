create table if not exists workflow_events (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null check (event_type in (
    'created','started','resumed','verifying','completed','failed','cancelled','step_checkpointed','recovered_stale'
  )),
  from_status text,
  to_status text,
  step_order integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_events_workflow_created_idx
  on workflow_events(workflow_id, created_at desc);
create index if not exists workflow_events_user_created_idx
  on workflow_events(user_id, created_at desc);
