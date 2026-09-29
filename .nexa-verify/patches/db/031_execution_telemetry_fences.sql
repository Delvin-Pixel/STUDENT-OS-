alter table tool_runs
  add column if not exists workflow_id uuid references workflows(id) on delete set null;

create index if not exists tool_runs_workflow_created_idx
  on tool_runs(workflow_id, created_at desc)
  where workflow_id is not null;

create unique index if not exists workflow_execution_attempts_identity_idx
  on workflow_execution_attempts(id, workflow_id, user_id);

alter table ai_runs
  add constraint ai_runs_workflow_attempt_presence_ck
  check ((workflow_id is null) = (execution_attempt_id is null)) not valid;

alter table tool_runs
  add constraint tool_runs_workflow_attempt_presence_ck
  check ((workflow_id is null) = (execution_attempt_id is null)) not valid;

alter table ai_runs
  add constraint ai_runs_execution_attempt_identity_fk
  foreign key (execution_attempt_id, workflow_id, user_id)
  references workflow_execution_attempts(id, workflow_id, user_id)
  on delete set null (execution_attempt_id, workflow_id)
  not valid;

alter table tool_runs
  add constraint tool_runs_execution_attempt_identity_fk
  foreign key (execution_attempt_id, workflow_id, user_id)
  references workflow_execution_attempts(id, workflow_id, user_id)
  on delete set null (execution_attempt_id, workflow_id)
  not valid;