-- NEXA 1.21: bounded indexes for request-scoped conversation execution traces.
create index if not exists tool_runs_conversation_request_created_idx
  on tool_runs(conversation_id, request_id, created_at asc, id asc)
  where conversation_id is not null and request_id is not null;

create index if not exists ai_runs_conversation_request_created_idx
  on ai_runs(conversation_id, request_id, created_at asc, id asc)
  where conversation_id is not null and request_id is not null;
