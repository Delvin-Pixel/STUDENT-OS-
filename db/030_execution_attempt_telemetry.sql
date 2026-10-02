alter table ai_runs
  add column if not exists execution_attempt_id uuid references workflow_execution_attempts(id) on delete set null;

alter table tool_runs
  add column if not exists execution_attempt_id uuid references workflow_execution_attempts(id) on delete set null;

create index if not exists ai_runs_execution_attempt_created_idx
  on ai_runs(execution_attempt_id, created_at desc)
  where execution_attempt_id is not null;

create index if not exists tool_runs_execution_attempt_created_idx
  on tool_runs(execution_attempt_id, created_at desc)
  where execution_attempt_id is not null;
