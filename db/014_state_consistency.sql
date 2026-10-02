alter table memories
  add column if not exists version integer not null default 1;

alter table memories
  drop constraint if exists memories_version_positive;

alter table memories
  add constraint memories_version_positive check (version > 0);

create index if not exists idempotency_keys_user_scope_expires_idx
  on idempotency_keys(user_id, scope, expires_at);
