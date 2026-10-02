create table if not exists chat_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 255),
  request_hash text not null check (char_length(request_hash) = 64),
  status text not null check (status in ('running', 'completed', 'failed', 'aborted')),
  conversation_id uuid references conversations(id) on delete set null,
  workflow_id uuid references workflows(id) on delete set null,
  execution_attempt_id uuid references workflow_execution_attempts(id) on delete set null,
  user_message_id uuid references messages(id) on delete set null,
  assistant_message_id uuid references messages(id) on delete set null,
  error_message text,
  response_status integer check (response_status between 200 and 599),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);

create index if not exists chat_turns_user_updated_idx
  on chat_turns(user_id, updated_at desc);

create index if not exists chat_turns_conversation_created_idx
  on chat_turns(conversation_id, created_at asc)
  where conversation_id is not null;

create index if not exists chat_turns_expires_idx
  on chat_turns(expires_at asc);
