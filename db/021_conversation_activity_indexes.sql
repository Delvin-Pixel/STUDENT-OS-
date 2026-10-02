-- NEXA 1.17: indexes for bounded conversation activity timelines.
create index if not exists tool_runs_conversation_created_idx
  on tool_runs(conversation_id, created_at desc)
  where conversation_id is not null;

create index if not exists ai_runs_conversation_created_idx
  on ai_runs(conversation_id, created_at desc)
  where conversation_id is not null;
