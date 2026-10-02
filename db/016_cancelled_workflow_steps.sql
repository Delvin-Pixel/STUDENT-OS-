-- Preserve an explicit terminal step state when users cancel active workflows.
alter table workflow_steps drop constraint if exists workflow_steps_status_check;
alter table workflow_steps
  add constraint workflow_steps_status_check
  check (status in ('queued','running','completed','failed','skipped','cancelled'));

create index if not exists workflow_steps_cancelled_idx
  on workflow_steps(workflow_id, status)
  where status = 'cancelled';
