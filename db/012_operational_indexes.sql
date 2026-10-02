-- NEXA 1.2: operational indexes for bounded maintenance/observability queries.
create index if not exists security_audit_events_created_idx
  on security_audit_events(created_at desc);

create index if not exists tool_runs_created_idx
  on tool_runs(created_at desc);
