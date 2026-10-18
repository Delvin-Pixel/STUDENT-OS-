alter table student_os_bridge_events
  drop constraint if exists student_os_bridge_events_operational_reason_check;

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
      'ai_gateway_status_unavailable',
      'runtime_role_security_violation',
      'runtime_role_security_unavailable',
      'data_api_platform_unavailable',
      'data_api_current_exposure',
      'data_api_future_default_risk',
      'data_api_isolation_unavailable'
    )
  );
