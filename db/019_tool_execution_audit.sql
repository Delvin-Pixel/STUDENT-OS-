alter table tool_runs
  add column if not exists risk text,
  add column if not exists attempt integer not null default 1,
  add column if not exists input_hash text,
  add column if not exists blocked_reason text;

alter table tool_runs drop constraint if exists tool_runs_status_check;
alter table tool_runs add constraint tool_runs_status_check check (status in ('success', 'error', 'blocked'));
alter table tool_runs add constraint tool_runs_risk_check check (risk is null or risk in ('read', 'write', 'external'));
alter table tool_runs add constraint tool_runs_attempt_check check (attempt >= 1);

create index if not exists tool_runs_user_tool_created_idx
  on tool_runs (user_id, tool_name, created_at desc);

create index if not exists tool_runs_status_created_idx
  on tool_runs (status, created_at desc);
