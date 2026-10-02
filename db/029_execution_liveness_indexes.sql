create index if not exists workflow_execution_attempts_workflow_running_heartbeat_idx
  on workflow_execution_attempts(workflow_id, heartbeat_at desc)
  where status = 'running';

create index if not exists workflow_execution_leases_attempt_expiry_idx
  on workflow_execution_leases(attempt_id, expires_at desc)
  where attempt_id is not null;
