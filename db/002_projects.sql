create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_updated_idx
  on projects(user_id, updated_at desc);

alter table conversations
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists conversations_project_updated_idx
  on conversations(project_id, updated_at desc);
