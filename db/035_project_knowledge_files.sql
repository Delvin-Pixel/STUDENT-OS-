create table if not exists project_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  filename text not null,
  media_type text not null,
  content text not null,
  size_bytes integer not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_files_project_filename_unique_idx
  on project_files(project_id, lower(filename));

create index if not exists project_files_user_updated_idx
  on project_files(user_id, updated_at desc);

create index if not exists project_files_project_updated_idx
  on project_files(project_id, updated_at desc);

create index if not exists project_files_search_idx
  on project_files using gin (to_tsvector('simple', coalesce(filename, '') || ' ' || content));
