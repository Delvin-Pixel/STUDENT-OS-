create table if not exists student_os_bridge_requests (
  external_user_id text not null check (char_length(external_user_id) between 1 and 128),
  request_id text not null check (
    char_length(request_id) between 1 and 128
    and request_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
  ),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  capability text not null check (
    capability in ('chat','explain','tutor','generateMaterial','generateQuiz','coach')
  ),
  status text not null check (status in ('running','completed','failed')),
  owner_request_id text not null check (char_length(owner_request_id) between 1 and 128),
  owner_attempt_id uuid not null,
  lease_expires_at timestamptz not null,
  response_status integer check (response_status between 100 and 599),
  response_body jsonb,
  recovery_count integer not null default 0 check (recovery_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (external_user_id, request_id),
  constraint student_os_bridge_requests_terminal_ck check (
    (status = 'running' and response_status is null and response_body is null and completed_at is null)
    or
    (status in ('completed','failed') and response_status is not null and response_body is not null and completed_at is not null)
  )
);

create index if not exists student_os_bridge_requests_expires_idx
  on student_os_bridge_requests(expires_at);

create index if not exists student_os_bridge_requests_live_lease_idx
  on student_os_bridge_requests(lease_expires_at)
  where status = 'running';
