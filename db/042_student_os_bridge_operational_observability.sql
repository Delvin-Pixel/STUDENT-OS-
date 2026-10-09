alter table student_os_bridge_events
  add column operational_reason text;

alter table student_os_bridge_events
  drop constraint if exists student_os_bridge_events_event_type_check;

alter table student_os_bridge_events
  add constraint student_os_bridge_events_event_type_check
  check (
    event_type in (
      'claimed','recovered','rate_limited','mismatch','in_progress',
      'replayed','completed','failed','ownership_lost','operational_rejected'
    )
  );

alter table student_os_bridge_events
  add constraint student_os_bridge_events_operational_reason_check
  check (
    operational_reason is null
    or operational_reason in (
      'ai_gateway_missing',
      'ai_gateway_timeout',
      'ai_gateway_authentication_failed',
      'ai_gateway_credits_exhausted',
      'ai_gateway_model_unavailable',
      'ai_gateway_provider_unavailable',
      'ai_gateway_status_unavailable'
    )
  );

alter table student_os_bridge_events
  add constraint student_os_bridge_events_operational_reason_event_check
  check (
    (event_type = 'operational_rejected' and operational_reason is not null)
    or
    (event_type <> 'operational_rejected' and operational_reason is null)
  );

create index student_os_bridge_events_operational_reason_created_idx
  on student_os_bridge_events(operational_reason, created_at desc)
  where operational_reason is not null;
