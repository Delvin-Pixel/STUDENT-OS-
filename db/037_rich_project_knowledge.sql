alter table project_files
  add column if not exists source_kind text not null default 'text',
  add column if not exists source_media_type text,
  add column if not exists source_size_bytes integer,
  add column if not exists source_sha256 text,
  add column if not exists extraction_status text not null default 'not_required',
  add column if not exists extraction_model text,
  add column if not exists extraction_failure_code text,
  add column if not exists extraction_updated_at timestamptz;

update project_files
set source_media_type = coalesce(source_media_type, media_type),
    source_size_bytes = coalesce(source_size_bytes, size_bytes),
    source_sha256 = coalesce(source_sha256, sha256),
    extraction_status = coalesce(extraction_status, 'not_required')
where source_media_type is null
   or source_size_bytes is null
   or source_sha256 is null;

alter table project_files
  alter column source_media_type set not null,
  alter column source_size_bytes set not null,
  alter column source_sha256 set not null;

alter table project_files
  add constraint project_files_source_kind_ck
    check (source_kind in ('text', 'rich')),
  add constraint project_files_source_size_ck
    check (source_size_bytes > 0),
  add constraint project_files_source_sha_ck
    check (source_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint project_files_extraction_status_ck
    check (extraction_status in ('not_required', 'pending', 'ready', 'failed')),
  add constraint project_files_extraction_payload_ck
    check (
      (source_kind = 'text'
        and extraction_status = 'not_required'
        and extraction_model is null
        and extraction_failure_code is null)
      or
      (source_kind = 'rich'
        and extraction_status in ('pending', 'ready', 'failed'))
    );

create table if not exists project_file_blobs (
  file_id uuid primary key,
  user_id uuid not null,
  project_id uuid not null,
  media_type text not null,
  byte_size integer not null check (byte_size > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  data bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_file_blobs_file_identity_fk
    foreign key (file_id, user_id, project_id)
    references project_files(id, user_id, project_id)
    on delete cascade,
  constraint project_file_blobs_size_ck
    check (octet_length(data) = byte_size)
);

create index if not exists project_file_blobs_project_idx
  on project_file_blobs(project_id, updated_at desc);

create index if not exists project_files_extraction_status_idx
  on project_files(project_id, extraction_status, updated_at desc);
