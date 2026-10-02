create table if not exists assistant_message_external_sources (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  conversation_id uuid not null,
  user_id uuid not null,
  source_order smallint not null check (source_order between 1 and 8),
  source_label text not null check (source_label ~ '^W[1-8]$'),
  provider text not null check (char_length(provider) between 1 and 60),
  source_url text not null check (char_length(source_url) between 8 and 2048 and source_url ~ '^https?://'),
  title text not null check (char_length(title) between 1 and 300),
  excerpt text not null check (char_length(excerpt) between 1 and 1200),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assistant_message_external_sources_message_fk
    foreign key (message_id, conversation_id)
    references messages(id, conversation_id)
    on delete cascade,
  constraint assistant_message_external_sources_conversation_owner_fk
    foreign key (conversation_id, user_id)
    references conversations(id, user_id)
    on delete cascade,
  constraint assistant_message_external_sources_message_order_uk unique (message_id, source_order),
  constraint assistant_message_external_sources_message_label_uk unique (message_id, source_label),
  constraint assistant_message_external_sources_message_url_uk unique (message_id, source_url)
);

create index if not exists assistant_message_external_sources_conversation_idx
  on assistant_message_external_sources(user_id, conversation_id, message_id, source_order);
