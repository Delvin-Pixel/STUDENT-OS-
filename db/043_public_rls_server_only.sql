alter table public.schema_migrations enable row level security;

drop policy if exists nexa_runtime_server_access on public.schema_migrations;

create policy nexa_runtime_server_access
  on public.schema_migrations
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.users enable row level security;

drop policy if exists nexa_runtime_server_access on public.users;

create policy nexa_runtime_server_access
  on public.users
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.sessions enable row level security;

drop policy if exists nexa_runtime_server_access on public.sessions;

create policy nexa_runtime_server_access
  on public.sessions
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.conversations enable row level security;

drop policy if exists nexa_runtime_server_access on public.conversations;

create policy nexa_runtime_server_access
  on public.conversations
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.messages enable row level security;

drop policy if exists nexa_runtime_server_access on public.messages;

create policy nexa_runtime_server_access
  on public.messages
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.usage_daily enable row level security;

drop policy if exists nexa_runtime_server_access on public.usage_daily;

create policy nexa_runtime_server_access
  on public.usage_daily
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.projects enable row level security;

drop policy if exists nexa_runtime_server_access on public.projects;

create policy nexa_runtime_server_access
  on public.projects
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.memories enable row level security;

drop policy if exists nexa_runtime_server_access on public.memories;

create policy nexa_runtime_server_access
  on public.memories
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.memory_events enable row level security;

drop policy if exists nexa_runtime_server_access on public.memory_events;

create policy nexa_runtime_server_access
  on public.memory_events
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.conversation_context enable row level security;

drop policy if exists nexa_runtime_server_access on public.conversation_context;

create policy nexa_runtime_server_access
  on public.conversation_context
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.artifacts enable row level security;

drop policy if exists nexa_runtime_server_access on public.artifacts;

create policy nexa_runtime_server_access
  on public.artifacts
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.workflows enable row level security;

drop policy if exists nexa_runtime_server_access on public.workflows;

create policy nexa_runtime_server_access
  on public.workflows
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.workflow_steps enable row level security;

drop policy if exists nexa_runtime_server_access on public.workflow_steps;

create policy nexa_runtime_server_access
  on public.workflow_steps
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.tool_runs enable row level security;

drop policy if exists nexa_runtime_server_access on public.tool_runs;

create policy nexa_runtime_server_access
  on public.tool_runs
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.workflow_checkpoints enable row level security;

drop policy if exists nexa_runtime_server_access on public.workflow_checkpoints;

create policy nexa_runtime_server_access
  on public.workflow_checkpoints
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.rate_limit_buckets enable row level security;

drop policy if exists nexa_runtime_server_access on public.rate_limit_buckets;

create policy nexa_runtime_server_access
  on public.rate_limit_buckets
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.security_audit_events enable row level security;

drop policy if exists nexa_runtime_server_access on public.security_audit_events;

create policy nexa_runtime_server_access
  on public.security_audit_events
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.idempotency_keys enable row level security;

drop policy if exists nexa_runtime_server_access on public.idempotency_keys;

create policy nexa_runtime_server_access
  on public.idempotency_keys
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.workflow_events enable row level security;

drop policy if exists nexa_runtime_server_access on public.workflow_events;

create policy nexa_runtime_server_access
  on public.workflow_events
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.ai_runs enable row level security;

drop policy if exists nexa_runtime_server_access on public.ai_runs;

create policy nexa_runtime_server_access
  on public.ai_runs
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.workflow_execution_leases enable row level security;

drop policy if exists nexa_runtime_server_access on public.workflow_execution_leases;

create policy nexa_runtime_server_access
  on public.workflow_execution_leases
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.workflow_execution_attempts enable row level security;

drop policy if exists nexa_runtime_server_access on public.workflow_execution_attempts;

create policy nexa_runtime_server_access
  on public.workflow_execution_attempts
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.workflow_execution_attempt_events enable row level security;

drop policy if exists nexa_runtime_server_access on public.workflow_execution_attempt_events;

create policy nexa_runtime_server_access
  on public.workflow_execution_attempt_events
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.chat_turns enable row level security;

drop policy if exists nexa_runtime_server_access on public.chat_turns;

create policy nexa_runtime_server_access
  on public.chat_turns
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.project_files enable row level security;

drop policy if exists nexa_runtime_server_access on public.project_files;

create policy nexa_runtime_server_access
  on public.project_files
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.project_file_embedding_states enable row level security;

drop policy if exists nexa_runtime_server_access on public.project_file_embedding_states;

create policy nexa_runtime_server_access
  on public.project_file_embedding_states
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.project_file_embedding_chunks enable row level security;

drop policy if exists nexa_runtime_server_access on public.project_file_embedding_chunks;

create policy nexa_runtime_server_access
  on public.project_file_embedding_chunks
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.project_file_blobs enable row level security;

drop policy if exists nexa_runtime_server_access on public.project_file_blobs;

create policy nexa_runtime_server_access
  on public.project_file_blobs
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.assistant_message_sources enable row level security;

drop policy if exists nexa_runtime_server_access on public.assistant_message_sources;

create policy nexa_runtime_server_access
  on public.assistant_message_sources
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.assistant_message_external_sources enable row level security;

drop policy if exists nexa_runtime_server_access on public.assistant_message_external_sources;

create policy nexa_runtime_server_access
  on public.assistant_message_external_sources
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.student_os_bridge_requests enable row level security;

drop policy if exists nexa_runtime_server_access on public.student_os_bridge_requests;

create policy nexa_runtime_server_access
  on public.student_os_bridge_requests
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');

alter table public.student_os_bridge_events enable row level security;

drop policy if exists nexa_runtime_server_access on public.student_os_bridge_events;

create policy nexa_runtime_server_access
  on public.student_os_bridge_events
  as permissive
  for all
  to public
  using (current_user = 'nexa_runtime')
  with check (current_user = 'nexa_runtime');
