create table if not exists workflow_execution_attempts (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  request_id text not null,
  status text not null check (status in ('running','completed','failed','cancelled','aborted','lease_lost','recovered')),
  terminal_reason text,
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(workflow_id, request_id)
);

create index if not exists workflow_execution_attempts_workflow_created_idx
  on workflow_execution_attempts(workflow_id, acquired_at desc);

create index if not exists workflow_execution_attempts_user_created_idx
  on workflow_execution_attempts(user_id, acquired_at desc);

create index if not exists workflow_execution_attempts_request_idx
  on workflow_execution_attempts(request_id);

alter table workflow_execution_leases
  add column if not exists attempt_id uuid references workflow_execution_attempts(id) on delete set null;

create unique index if not exists workflow_execution_leases_attempt_idx
  on workflow_execution_leases(attempt_id)
  where attempt_id is not null;
