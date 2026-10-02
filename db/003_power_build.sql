alter table messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists messages_metadata_gin_idx
  on messages using gin (metadata);
