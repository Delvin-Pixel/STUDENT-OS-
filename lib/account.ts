import type { PoolClient, QueryResultRow } from 'pg';
import { query, withTransaction } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { recordSecurityEvent } from '@/lib/audit';

export const EXPORT_SCHEMA_VERSION = '1.23';
export const EXPORT_LIMIT_PER_COLLECTION = 25_000;
export const EXPORT_LIMIT_TOTAL_RECORDS = 100_000;
export const EXPORT_LIMIT_TOTAL_BYTES = 25_000_000;

export class AccountExportLimitError extends Error {
  constructor(public readonly collection: string) {
    super(`Account export exceeds the ${EXPORT_LIMIT_PER_COLLECTION.toLocaleString()} record limit for ${collection}.`);
    this.name = 'AccountExportLimitError';
  }
}

export class AccountExportSizeError extends Error {
  constructor(public readonly bytes: number) {
    super('Account export exceeds the supported one-click size limit.');
    this.name = 'AccountExportSizeError';
  }
}

export class AccountCredentialError extends Error {
  constructor() {
    super('Account confirmation failed.');
    this.name = 'AccountCredentialError';
  }
}

type Collection = { name: string; rows: unknown[] };

async function fetchCollection<T extends QueryResultRow>(
  client: PoolClient,
  name: string,
  sql: string,
  values: unknown[],
) {
  const result = await client.query<T>(`${sql} limit ${EXPORT_LIMIT_PER_COLLECTION + 1}`, values);
  if (result.rows.length > EXPORT_LIMIT_PER_COLLECTION) throw new AccountExportLimitError(name);
  return { name, rows: result.rows as unknown[] } satisfies Collection;
}

export async function buildAccountExport(userId: string, exportedAt = new Date().toISOString()) {
  return withTransaction(async (client) => {
    await client.query('set transaction isolation level repeatable read');
    const user = await client.query(
      `select id, email, name, plan, memory_enabled, created_at
       from users where id = $1 for share`,
      [userId],
    );
    if (!user.rows[0]) throw new Error('UNAUTHENTICATED');

    const collections = await Promise.all([
      fetchCollection(client, 'projects', 'select id, name, description, created_at, updated_at from projects where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'conversations', 'select id, project_id, title, created_at, updated_at from conversations where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'messages', `select m.id, m.conversation_id, m.role, m.content, m.metadata, m.execution_attempt_id, m.created_at
        from messages m join conversations c on c.id = m.conversation_id
        where c.user_id = $1 order by m.created_at asc`, [userId]),
      fetchCollection(client, 'assistant_message_sources', `select s.id, s.message_id, s.conversation_id, s.project_id, s.source_order, s.source_label, s.source_type, s.source_id, s.title, s.excerpt, s.retrieval, s.relevance, s.source_updated_at, s.created_at
        from assistant_message_sources s join conversations c on c.id = s.conversation_id
        where s.user_id = $1 and c.user_id = $1 order by s.created_at asc, s.source_order asc`, [userId]),
      fetchCollection(client, 'assistant_message_external_sources', `select s.id, s.message_id, s.conversation_id, s.source_order, s.source_label, s.provider, s.source_url, s.title, s.excerpt, s.source_updated_at, s.created_at
        from assistant_message_external_sources s join conversations c on c.id = s.conversation_id
        where s.user_id = $1 and c.user_id = $1 order by s.created_at asc, s.source_order asc`, [userId]),
      fetchCollection(client, 'memories', 'select id, project_id, scope, kind, label, content, source_conversation_id, importance, version, created_at, updated_at from memories where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'memory_events', 'select id, memory_id, action, created_at from memory_events where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'conversation_context', 'select conversation_id, summary, key_topics, updated_at from conversation_context where user_id = $1 order by updated_at asc', [userId]),
      fetchCollection(client, 'artifacts', 'select id, project_id, conversation_id, title, filename, artifact_type, mime_type, language, content, metadata, version, created_at, updated_at from artifacts where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'project_files', 'select id, project_id, filename, media_type, content, size_bytes, sha256, source_kind, source_media_type, source_size_bytes, source_sha256, extraction_status, extraction_model, extraction_failure_code, extraction_updated_at, version, created_at, updated_at from project_files where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'project_file_embedding_states', 'select file_id, project_id, content_sha256, model_id, dimensions, status, chunk_count, failure_code, created_at, updated_at from project_file_embedding_states where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'workflows', 'select id, project_id, conversation_id, title, request, workflow_type, status, plan, result_summary, metadata, created_at, updated_at, completed_at from workflows where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'workflow_steps', `select s.id, s.workflow_id, s.step_order, s.title, s.kind, s.status, s.tool_names, s.input, s.output, s.started_at, s.completed_at
        from workflow_steps s join workflows w on w.id = s.workflow_id
        where w.user_id = $1 order by s.workflow_id asc, s.step_order asc`, [userId]),
      fetchCollection(client, 'workflow_checkpoints', `select c.id, c.workflow_id, c.step_order, c.checkpoint_key, c.status, c.state, c.resume_count, c.last_error, c.created_at, c.updated_at
        from workflow_checkpoints c join workflows w on w.id = c.workflow_id
        where w.user_id = $1 order by c.workflow_id asc, c.step_order asc`, [userId]),
      fetchCollection(client, 'workflow_events', 'select id, workflow_id, event_type, from_status, to_status, step_order, details, created_at from workflow_events where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'tool_runs', 'select id, conversation_id, project_id, workflow_id, request_id, execution_attempt_id, tool_name, risk, status, attempt, input_hash, blocked_reason, duration_ms, error_message, created_at from tool_runs where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'usage_daily', 'select usage_date, message_count from usage_daily where user_id = $1 order by usage_date asc', [userId]),
      fetchCollection(client, 'ai_runs', 'select id, conversation_id, workflow_id, request_id, execution_attempt_id, model, status, step_count, input_tokens, output_tokens, total_tokens, finish_reason, error_name, duration_ms, created_at, completed_at from ai_runs where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'workflow_execution_attempts', 'select id, workflow_id, request_id, status, terminal_reason, acquired_at, heartbeat_at, completed_at from workflow_execution_attempts where user_id = $1 order by acquired_at asc', [userId]),
      fetchCollection(client, 'workflow_execution_attempt_events', 'select id, attempt_id, workflow_id, event_type, details, created_at from workflow_execution_attempt_events where user_id = $1 order by created_at asc', [userId]),
      fetchCollection(client, 'chat_turns', 'select id, idempotency_key, request_hash, status, response_status, conversation_id, workflow_id, execution_attempt_id, user_message_id, assistant_message_id, error_message, expires_at, created_at, updated_at, completed_at from chat_turns where user_id = $1 order by created_at asc', [userId]),
    ]);

    const totalRecords = collections.reduce((sum, collection) => sum + collection.rows.length, 0);
    if (totalRecords > EXPORT_LIMIT_TOTAL_RECORDS) {
      throw new AccountExportLimitError('total export');
    }
    const estimatedBytes = Buffer.byteLength(JSON.stringify(collections), 'utf8');
    if (estimatedBytes > EXPORT_LIMIT_TOTAL_BYTES) {
      throw new AccountExportSizeError(estimatedBytes);
    }

    await recordSecurityEvent({
      action: 'data_exported',
      userId,
      metadata: { schemaVersion: EXPORT_SCHEMA_VERSION, recordCount: totalRecords },
      client,
    });

    return {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt,
      account: user.rows[0],
      collections: Object.fromEntries(collections.map((collection) => [collection.name, collection.rows])),
      excluded: ['sessions', 'rate_limit_buckets', 'idempotency_keys', 'security_audit_events', 'project_file_embedding_chunks', 'project_file_blobs'],
      recordCount: totalRecords,
    };
  });
}

export async function deleteAccount(params: { userId: string; email: string; password: string; requestId?: string }) {
  const user = await query<{ id: string; email: string; password_hash: string }>(
    'select id, email, password_hash from users where id = $1 limit 1',
    [params.userId],
  );
  if (!user.rows[0] || user.rows[0].email !== params.email.trim().toLowerCase() || !(await verifyPassword(params.password, user.rows[0].password_hash))) {
    throw new AccountCredentialError();
  }

  return withTransaction(async (client) => {
    const locked = await client.query<{ id: string }>('select id from users where id = $1 for update', [params.userId]);
    if (!locked.rows[0]) throw new AccountCredentialError();

    await recordSecurityEvent({
      action: 'account_deleted',
      userId: params.userId,
      requestId: params.requestId,
      success: true,
      metadata: { deletionMode: 'hard_delete' },
      client,
    });

    await client.query('delete from users where id = $1', [params.userId]);
    return true;
  });
}
