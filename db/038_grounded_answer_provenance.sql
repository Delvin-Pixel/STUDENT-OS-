-- NEXA 1.53: durable assistant grounding provenance.

do $$
begin
  alter table conversations
    add constraint conversations_id_user_identity_uk unique (id, user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table messages
    add constraint messages_id_conversation_identity_uk unique (id, conversation_id);
exception
  when duplicate_object then null;
end $$;

create table if not exists assistant_message_sources (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  conversation_id uuid not null,
  user_id uuid not null,
  project_id uuid,
  source_order smallint not null check (source_order between 1 and 12),
  source_label text not null check (source_label ~ '^S([1-9]|1[0-2])$'),
  source_type text not null check (source_type in ('conversation', 'artifact', 'memory', 'workflow', 'file')),
  source_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  excerpt text not null check (char_length(excerpt) between 1 and 1200),
  retrieval text check (retrieval is null or retrieval in ('lexical', 'semantic', 'hybrid')),
  relevance double precision check (relevance is null or relevance >= 0),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assistant_message_sources_message_fk
    foreign key (message_id, conversation_id)
    references messages(id, conversation_id)
    on delete cascade,
  constraint assistant_message_sources_conversation_owner_fk
    foreign key (conversation_id, user_id)
    references conversations(id, user_id)
    on delete cascade,
  constraint assistant_message_sources_message_order_uk unique (message_id, source_order),
  constraint assistant_message_sources_message_label_uk unique (message_id, source_label)
);

create index if not exists assistant_message_sources_conversation_idx
  on assistant_message_sources(user_id, conversation_id, message_id, source_order);

create index if not exists assistant_message_sources_source_idx
  on assistant_message_sources(user_id, project_id, source_type, source_id)
  where source_id is not null;
