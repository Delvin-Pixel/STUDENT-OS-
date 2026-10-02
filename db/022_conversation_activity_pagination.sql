-- NEXA 1.19: stable cursor pagination indexes for conversation activity.
create index if not exists workflow_events_conversation_created_idx
  on workflow_events(workflow_id, created_at desc, id desc)
  where workflow_id is not null;

create index if not exists tool_runs_conversation_created_id_idx
  on tool_runs(conversation_id, created_at desc, id desc)
  where conversation_id is not null;

create index if not exists ai_runs_conversation_created_id_idx
  on ai_runs(conversation_id, created_at desc, id desc)
  where conversation_id is not null;
