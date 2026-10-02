-- NEXA 1.9: agent execution telemetry.
create table if not exists ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  workflow_id uuid references workflows(id) on delete set null,
  request_id text,
  model text not null,
  status text not null check (status in ('running','completed','failed')),
  step_count integer not null default 0 check (step_count >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  finish_reason text,
  error_name text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_runs_user_created_idx on ai_runs(user_id, created_at desc);
create index if not exists ai_runs_workflow_created_idx on ai_runs(workflow_id, created_at desc);
create index if not exists ai_runs_request_idx on ai_runs(request_id) where request_id is not null;
