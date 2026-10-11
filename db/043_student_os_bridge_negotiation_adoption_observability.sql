alter table student_os_bridge_events
  add column bridge_contract_version text;

alter table student_os_bridge_events
  add column contract_negotiation_source text;

alter table student_os_bridge_events
  add constraint student_os_bridge_events_bridge_contract_version_check
  check (
    bridge_contract_version is null
    or bridge_contract_version ~ '^[0-9]+\.[0-9]+$'
  );

alter table student_os_bridge_events
  add constraint student_os_bridge_events_contract_negotiation_source_check
  check (
    contract_negotiation_source is null
    or contract_negotiation_source in ('explicit', 'legacy-default')
  );

alter table student_os_bridge_events
  add constraint student_os_bridge_events_contract_negotiation_pair_check
  check (
    (bridge_contract_version is null and contract_negotiation_source is null)
    or
    (bridge_contract_version is not null and contract_negotiation_source is not null)
  );

create index student_os_bridge_events_negotiation_created_idx
  on student_os_bridge_events(contract_negotiation_source, bridge_contract_version, created_at desc)
  where contract_negotiation_source is not null;
