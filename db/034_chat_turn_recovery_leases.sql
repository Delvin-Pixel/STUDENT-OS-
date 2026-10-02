alter table chat_turns
  add column if not exists owner_request_id text,
  add column if not exists owner_attempt_id uuid,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists recovery_count integer not null default 0 check (recovery_count >= 0),
  add column if not exists quota_consumed_at timestamptz;

update chat_turns
set owner_request_id = coalesce(owner_request_id, 'legacy-' || id::text),
    owner_attempt_id = coalesce(owner_attempt_id, gen_random_uuid()),
    heartbeat_at = coalesce(heartbeat_at, updated_at),
    lease_expires_at = coalesce(lease_expires_at, updated_at + interval '30 seconds')
where status = 'running';

create index if not exists chat_turns_running_lease_idx
  on chat_turns(lease_expires_at asc)
  where status = 'running';

create index if not exists chat_turns_owner_attempt_idx
  on chat_turns(owner_attempt_id)
  where owner_attempt_id is not null;
