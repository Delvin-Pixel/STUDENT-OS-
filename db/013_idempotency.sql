create table if not exists idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  scope text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique(user_id, scope, idempotency_key)
);

create index if not exists idempotency_keys_expires_idx
  on idempotency_keys(expires_at);
