create table if not exists workflow_execution_attempt_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references workflow_execution_attempts(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null check (event_type in ('acquired','lease_lost','recovered','completed','failed','cancelled','aborted')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_execution_attempt_events_attempt_created_idx
  on workflow_execution_attempt_events(attempt_id, created_at asc, id asc);
create index if not exists workflow_execution_attempt_events_user_created_idx
  on workflow_execution_attempt_events(user_id, created_at asc, id asc);
create index if not exists workflow_execution_attempt_events_workflow_created_idx
  on workflow_execution_attempt_events(workflow_id, created_at asc, id asc);
