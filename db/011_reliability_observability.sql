-- NEXA 1.1: security observability and operational hygiene.
create table if not exists security_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text not null check (action in ('signup','login_success','login_failed','logout','rate_limited','health_check')),
  request_id text,
  success boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_audit_events_user_created_idx
  on security_audit_events(user_id, created_at desc)
  where user_id is not null;

create index if not exists security_audit_events_action_created_idx
  on security_audit_events(action, created_at desc);

create index if not exists security_audit_events_request_idx
  on security_audit_events(request_id)
  where request_id is not null;
