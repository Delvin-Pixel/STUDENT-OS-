alter table workflow_execution_attempt_events
  add column if not exists sequence_no bigint;

with ranked as (
  select id,
         row_number() over (partition by attempt_id order by created_at asc, id asc) as sequence_no
  from workflow_execution_attempt_events
)
update workflow_execution_attempt_events e
set sequence_no = ranked.sequence_no
from ranked
where e.id = ranked.id
  and e.sequence_no is null;

alter table workflow_execution_attempt_events
  alter column sequence_no set not null;

create unique index if not exists workflow_execution_attempt_events_attempt_sequence_idx
  on workflow_execution_attempt_events(attempt_id, sequence_no);

create index if not exists workflow_execution_attempt_events_attempt_sequence_read_idx
  on workflow_execution_attempt_events(attempt_id, sequence_no asc);
