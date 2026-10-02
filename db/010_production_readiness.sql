-- NEXA 1.0: production-readiness primitives.
-- Rate-limit counters are deliberately separate from usage accounting so abuse controls
-- cannot alter billable/daily product usage.
create table if not exists rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (bucket_key, window_start)
);

create index if not exists rate_limit_buckets_expires_idx
  on rate_limit_buckets(expires_at);

create index if not exists sessions_token_expires_idx
  on sessions(token_hash, expires_at);

create index if not exists workflow_checkpoints_status_idx
  on workflow_checkpoints(workflow_id, status, step_order, updated_at asc);
