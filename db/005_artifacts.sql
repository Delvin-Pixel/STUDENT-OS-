create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  title text not null,
  filename text not null,
  artifact_type text not null check (artifact_type in ('document', 'report', 'code', 'data', 'note')),
  mime_type text not null default 'text/plain',
  language text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artifacts_user_updated_idx on artifacts(user_id, updated_at desc);
create index if not exists artifacts_project_updated_idx on artifacts(project_id, updated_at desc);
create index if not exists artifacts_conversation_updated_idx on artifacts(conversation_id, updated_at desc);
