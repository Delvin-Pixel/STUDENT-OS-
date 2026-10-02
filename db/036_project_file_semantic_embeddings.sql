create unique index if not exists project_files_identity_unique_idx
  on project_files(id, user_id, project_id);

create table if not exists project_file_embedding_states (
  file_id uuid primary key,
  user_id uuid not null,
  project_id uuid not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  model_id text not null check (char_length(model_id) between 1 and 200),
  dimensions integer check (dimensions is null or dimensions between 1 and 4096),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  chunk_count integer not null default 0 check (chunk_count between 0 and 32),
  failure_code text check (failure_code is null or failure_code ~ '^[a-z0-9_:-]{1,80}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_file_embedding_states_file_identity_fk
    foreign key (file_id, user_id, project_id)
    references project_files(id, user_id, project_id)
    on delete cascade,
  constraint project_file_embedding_states_status_payload_ck check (
    (status = 'pending' and dimensions is null and chunk_count = 0 and failure_code is null)
    or (status = 'ready' and dimensions is not null and chunk_count > 0 and failure_code is null)
    or (status = 'failed' and dimensions is null and chunk_count = 0 and failure_code is not null)
  )
);

create table if not exists project_file_embedding_chunks (
  file_id uuid not null,
  user_id uuid not null,
  project_id uuid not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  model_id text not null check (char_length(model_id) between 1 and 200),
  dimensions integer not null check (dimensions between 1 and 4096),
  chunk_index integer not null check (chunk_index between 0 and 31),
  content_excerpt text not null check (char_length(content_excerpt) between 1 and 2000),
  embedding real[] not null,
  created_at timestamptz not null default now(),
  primary key (file_id, chunk_index),
  constraint project_file_embedding_chunks_file_identity_fk
    foreign key (file_id, user_id, project_id)
    references project_files(id, user_id, project_id)
    on delete cascade,
  constraint project_file_embedding_chunks_dimensions_ck
    check (array_ndims(embedding) = 1 and cardinality(embedding) = dimensions)
);

create index if not exists project_file_embedding_states_project_status_idx
  on project_file_embedding_states(project_id, status, updated_at desc);

create index if not exists project_file_embedding_states_user_updated_idx
  on project_file_embedding_states(user_id, updated_at desc);

create index if not exists project_file_embedding_chunks_project_idx
  on project_file_embedding_chunks(project_id, file_id, chunk_index);

insert into project_file_embedding_states (file_id, user_id, project_id, content_sha256, model_id, status)
select id, user_id, project_id, sha256, 'unindexed', 'pending'
from project_files
on conflict (file_id) do nothing;
