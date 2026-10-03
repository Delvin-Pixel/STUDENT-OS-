create table if not exists student_os_bridge_events (
  id uuid primary key default gen_random_uuid(),
  user_fingerprint text not null check (user_fingerprint ~ '^[0-9a-f]{64}$'),
  bridge_request_id text not null check (
    char_length(bridge_request_id) between 1 and 128
    and bridge_request_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
  ),
  server_request_id text not null check (char_length(server_request_id) between 1 and 128),
  capability text not null check (
    capability in ('chat','explain','tutor','generateMaterial','generateQuiz','coach')
  ),
  event_type text not null check (
    event_type in (
      'claimed','recovered','rate_limited','mismatch','in_progress',
      'replayed','completed','failed','ownership_lost'
    )
  ),
  http_status integer check (http_status between 100 and 599),
  duration_ms integer not null default 0 check (duration_ms between 0 and 86400000),
  limit_scope text check (
    limit_scope is null or limit_scope in ('global-minute','user-minute','user-hour')
  ),
  provider_ok boolean,
  created_at timestamptz not null default now()
);

create index if not exists student_os_bridge_events_created_idx
  on student_os_bridge_events(created_at desc);

create index if not exists student_os_bridge_events_request_created_idx
  on student_os_bridge_events(bridge_request_id, created_at desc);

create index if not exists student_os_bridge_events_user_created_idx
  on student_os_bridge_events(user_fingerprint, created_at desc);

create index if not exists student_os_bridge_events_type_created_idx
  on student_os_bridge_events(event_type, created_at desc);
