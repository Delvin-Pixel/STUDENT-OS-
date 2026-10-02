-- NEXA 1.8: account privacy operations.
alter table security_audit_events
  drop constraint if exists security_audit_events_action_check;

alter table security_audit_events
  add constraint security_audit_events_action_check
  check (action in (
    'signup','login_success','login_failed','logout','rate_limited','health_check',
    'data_exported','account_deleted'
  ));
