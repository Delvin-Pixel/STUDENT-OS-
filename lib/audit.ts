import { query } from '@/lib/db';
import type { PoolClient } from 'pg';

export type SecurityAuditAction =
  | 'signup'
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'rate_limited'
  | 'health_check'
  | 'data_exported'
  | 'account_deleted';

export async function recordSecurityEvent(input: {
  action: SecurityAuditAction;
  userId?: string | null;
  requestId?: string | null;
  success?: boolean;
  metadata?: Record<string, unknown>;
  client?: PoolClient;
}) {
  try {
    const values = [
      input.userId ?? null,
      input.action,
      input.requestId ?? null,
      input.success ?? true,
      JSON.stringify(input.metadata ?? {}),
    ];
    const sql = `insert into security_audit_events (user_id, action, request_id, success, metadata)
                 values ($1, $2, $3, $4, $5::jsonb)`;
    if (input.client) {
      await input.client.query(sql, values);
    } else {
      await query(sql, values);
    }
  } catch {
    // Security observability must never break authentication or request handling.
  }
}
