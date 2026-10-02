create table if not exists workflow_execution_leases (
  workflow_id uuid primary key references workflows(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  request_id text not null,
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists workflow_execution_leases_expires_idx
  on workflow_execution_leases(expires_at);

create index if not exists workflow_execution_leases_user_idx
  on workflow_execution_leases(user_id, expires_at);
