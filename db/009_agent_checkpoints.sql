create table if not exists workflow_checkpoints (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  step_order integer not null,
  checkpoint_key text not null,
  status text not null default 'pending' check (status in ('pending','ready','consumed','blocked')),
  state jsonb not null default '{}'::jsonb,
  resume_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workflow_id, checkpoint_key)
);

create index if not exists workflow_checkpoints_workflow_idx on workflow_checkpoints(workflow_id, step_order, updated_at desc);
