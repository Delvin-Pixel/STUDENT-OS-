-- NEXA 0.6: project intelligence indexes + retrieval metadata.
-- Keeps retrieval lexical and inspectable now; semantic embeddings can be added later without changing the user-facing contract.

create index if not exists messages_content_search_idx
  on messages using gin (to_tsvector('simple', content));

create index if not exists artifacts_search_idx
  on artifacts using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(filename, '') || ' ' || coalesce(content, '')));

create index if not exists conversation_context_topics_idx
  on conversation_context using gin (key_topics);

create index if not exists workflows_project_status_idx
  on workflows(project_id, status, updated_at desc);
