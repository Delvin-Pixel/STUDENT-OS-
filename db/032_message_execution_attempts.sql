alter table messages
  add column if not exists execution_attempt_id uuid references workflow_execution_attempts(id) on delete set null;

create index if not exists messages_execution_attempt_created_idx
  on messages(execution_attempt_id, created_at asc)
  where execution_attempt_id is not null;
