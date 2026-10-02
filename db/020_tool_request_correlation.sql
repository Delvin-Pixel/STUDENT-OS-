-- NEXA 1.16: correlate every tool execution with the originating request.
alter table tool_runs
  add column if not exists request_id text;

create index if not exists tool_runs_request_idx
  on tool_runs(request_id, created_at desc)
  where request_id is not null;
