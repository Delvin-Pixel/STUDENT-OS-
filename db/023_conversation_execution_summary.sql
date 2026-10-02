-- NEXA 1.20: indexes for bounded conversation execution-state summaries.
create index if not exists ai_runs_conversation_status_idx
  on ai_runs(conversation_id, user_id, status)
  where conversation_id is not null;

create index if not exists workflows_conversation_status_idx
  on workflows(conversation_id, user_id, status)
  where conversation_id is not null;

create index if not exists tool_runs_conversation_user_created_idx
  on tool_runs(conversation_id, user_id, created_at desc)
  where conversation_id is not null;
