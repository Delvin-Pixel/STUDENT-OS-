#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for PostgreSQL recovery integration testing.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});

const email = `nexa-recovery-${randomUUID()}@example.invalid`;
let userId = null;

async function scalar(client, text, params = []) {
  const result = await client.query(text, params);
  return result.rows[0];
}

try {
  const version = await pool.query("select current_setting('server_version_num')::int as version_num");
  assert.ok(Number(version.rows[0]?.version_num) >= 150000, 'PostgreSQL 15+ is required for the integration contract.');

  const migrated = await pool.query("select version from schema_migrations where version = '034_chat_turn_recovery_leases.sql'");
  assert.equal(migrated.rows.length, 1, 'Migration 034 must be applied before the recovery integration test.');

  const user = await pool.query(
    `insert into users (email, name, password_hash, plan)
     values ($1, 'NEXA Recovery Test', 'test-only-not-a-real-password-hash', 'free')
     returning id`,
    [email],
  );
  userId = user.rows[0].id;

  const requestHash = 'a'.repeat(64);
  const requestA = `req-a-${randomUUID()}`;
  const attemptA = randomUUID();
  const requestB = `req-b-${randomUUID()}`;
  const attemptB = randomUUID();
  const idempotencyKey = `nexa-it-${randomUUID()}`;

  const createdTurn = await pool.query(
    `insert into chat_turns (
       user_id, idempotency_key, request_hash, status, expires_at,
       owner_request_id, owner_attempt_id, heartbeat_at, lease_expires_at
     ) values (
       $1, $2, $3, 'running', now() + interval '24 hours',
       $4, $5::uuid, now(), now() + interval '15 seconds'
     ) returning id`,
    [userId, idempotencyKey, requestHash, requestA, attemptA],
  );
  const turnId = createdTurn.rows[0].id;

  const conversation = await pool.query(
    `insert into conversations (user_id, title) values ($1, 'Recovery integration test') returning id`,
    [userId],
  );
  const conversationId = conversation.rows[0].id;
  const userMessage = await pool.query(
    `insert into messages (conversation_id, role, content, metadata)
     values ($1, 'user', 'hello recovery', '{}'::jsonb) returning id`,
    [conversationId],
  );
  const userMessageId = userMessage.rows[0].id;

  await pool.query(
    `insert into usage_daily (user_id, usage_date, message_count)
     values ($1, current_date, 1)`,
    [userId],
  );
  await pool.query(
    `update chat_turns
     set conversation_id = $2, user_message_id = $3, quota_consumed_at = now(),
         lease_expires_at = clock_timestamp() - interval '1 second', updated_at = now()
     where id = $1`,
    [turnId, conversationId, userMessageId],
  );

  const reclaimClient = await pool.connect();
  try {
    await reclaimClient.query('begin');
    const stale = await scalar(
      reclaimClient,
      `select owner_request_id, owner_attempt_id, lease_expires_at
       from chat_turns where id = $1 and user_id = $2 and status = 'running' for update`,
      [turnId, userId],
    );
    assert.equal(stale.owner_request_id, requestA);
    assert.equal(stale.owner_attempt_id, attemptA);
    assert.ok(new Date(stale.lease_expires_at).getTime() <= Date.now(), 'Original lease must be expired before recovery.');

    const recovered = await reclaimClient.query(
      `update chat_turns
       set owner_request_id = $3,
           owner_attempt_id = $4::uuid,
           heartbeat_at = clock_timestamp(),
           lease_expires_at = clock_timestamp() + interval '250 milliseconds',
           recovery_count = recovery_count + 1,
           updated_at = now()
       where id = $1 and user_id = $2 and status = 'running'
       returning recovery_count, conversation_id, user_message_id, quota_consumed_at`,
      [turnId, userId, requestB, attemptB],
    );
    assert.equal(recovered.rows[0].recovery_count, 1);
    assert.equal(recovered.rows[0].conversation_id, conversationId);
    assert.equal(recovered.rows[0].user_message_id, userMessageId);
    assert.ok(recovered.rows[0].quota_consumed_at, 'Recovered turn must preserve durable quota consumption.');
    await reclaimClient.query('commit');
  } catch (error) {
    await reclaimClient.query('rollback');
    throw error;
  } finally {
    reclaimClient.release();
  }

  const staleOwned = await pool.query(
    `select id from chat_turns
     where id = $1 and user_id = $2 and status = 'running'
       and owner_request_id = $3 and owner_attempt_id = $4::uuid
       and lease_expires_at > clock_timestamp()`,
    [turnId, userId, requestA, attemptA],
  );
  assert.equal(staleOwned.rows.length, 0, 'Recovered ownership must fence the stale owner immediately.');

  // Prove the final assistant write is atomic with turn completion if the lease expires mid-transaction.
  const expiringClient = await pool.connect();
  let rolledBackAssistantId = null;
  try {
    await expiringClient.query('begin');
    const owned = await expiringClient.query(
      `select id from chat_turns
       where id = $1 and user_id = $2 and status = 'running'
         and owner_request_id = $3 and owner_attempt_id = $4::uuid
         and lease_expires_at > clock_timestamp()
       for update`,
      [turnId, userId, requestB, attemptB],
    );
    assert.equal(owned.rows.length, 1, 'Recovered owner should initially hold the live lease.');

    const inserted = await expiringClient.query(
      `insert into messages (conversation_id, role, content, metadata, execution_attempt_id)
       values ($1, 'assistant', 'must roll back', '{}'::jsonb, null)
       returning id`,
      [conversationId],
    );
    rolledBackAssistantId = inserted.rows[0].id;
    await expiringClient.query('select pg_sleep(0.35)');

    const completed = await expiringClient.query(
      `update chat_turns
       set status = 'completed', assistant_message_id = $5::uuid,
           error_message = null, response_status = 200, updated_at = now(), completed_at = now(),
           lease_expires_at = clock_timestamp()
       where id = $1 and user_id = $2 and status = 'running'
         and owner_request_id = $3 and owner_attempt_id = $4::uuid
         and lease_expires_at > clock_timestamp()
       returning id`,
      [turnId, userId, requestB, attemptB, rolledBackAssistantId],
    );
    assert.equal(completed.rows.length, 0, 'Completion must fail after the lease expires.');
    await expiringClient.query('rollback');
  } finally {
    expiringClient.release();
  }

  const rolledBack = await pool.query('select id from messages where id = $1', [rolledBackAssistantId]);
  assert.equal(rolledBack.rows.length, 0, 'Assistant insert must roll back when turn completion loses its lease.');

  await pool.query(
    `update chat_turns
     set heartbeat_at = now(), lease_expires_at = clock_timestamp() + interval '15 seconds', updated_at = now()
     where id = $1 and user_id = $2 and status = 'running'
       and owner_request_id = $3 and owner_attempt_id = $4::uuid`,
    [turnId, userId, requestB, attemptB],
  );

  const finalClient = await pool.connect();
  let assistantMessageId = null;
  try {
    await finalClient.query('begin');
    const owned = await finalClient.query(
      `select id from chat_turns
       where id = $1 and user_id = $2 and status = 'running'
         and owner_request_id = $3 and owner_attempt_id = $4::uuid
         and lease_expires_at > clock_timestamp()
       for update`,
      [turnId, userId, requestB, attemptB],
    );
    assert.equal(owned.rows.length, 1);

    const assistant = await finalClient.query(
      `insert into messages (conversation_id, role, content, metadata, execution_attempt_id)
       values ($1, 'assistant', 'recovered response', '{}'::jsonb, null)
       returning id`,
      [conversationId],
    );
    assistantMessageId = assistant.rows[0].id;

    const completed = await finalClient.query(
      `update chat_turns
       set status = 'completed', assistant_message_id = $5::uuid,
           error_message = null, response_status = 200, updated_at = now(), completed_at = now(),
           lease_expires_at = clock_timestamp()
       where id = $1 and user_id = $2 and status = 'running'
         and owner_request_id = $3 and owner_attempt_id = $4::uuid
         and lease_expires_at > clock_timestamp()
       returning id`,
      [turnId, userId, requestB, attemptB, assistantMessageId],
    );
    assert.equal(completed.rows.length, 1, 'Recovered owner must be able to atomically persist the final response.');
    await finalClient.query('commit');
  } catch (error) {
    await finalClient.query('rollback');
    throw error;
  } finally {
    finalClient.release();
  }

  const finalState = await scalar(
    pool,
    `select status, recovery_count, conversation_id, user_message_id, assistant_message_id,
            quota_consumed_at, response_status
     from chat_turns where id = $1`,
    [turnId],
  );
  assert.equal(finalState.status, 'completed');
  assert.equal(finalState.recovery_count, 1);
  assert.equal(finalState.conversation_id, conversationId);
  assert.equal(finalState.user_message_id, userMessageId);
  assert.equal(finalState.assistant_message_id, assistantMessageId);
  assert.equal(finalState.response_status, 200);
  assert.ok(finalState.quota_consumed_at);

  const counts = await scalar(
    pool,
    `select
       count(*) filter (where role = 'user')::int as user_count,
       count(*) filter (where role = 'assistant')::int as assistant_count
     from messages where conversation_id = $1`,
    [conversationId],
  );
  assert.equal(counts.user_count, 1, 'Recovery must not duplicate the user message.');
  assert.equal(counts.assistant_count, 1, 'Recovery must persist exactly one assistant message.');

  const usage = await scalar(pool, 'select message_count from usage_daily where user_id = $1 and usage_date = current_date', [userId]);
  assert.equal(usage.message_count, 1, 'Recovery must not double-charge daily quota.');

  const replay = await scalar(
    pool,
    `select m.id, m.content
     from messages m
     join conversations c on c.id = m.conversation_id
     where m.id = $1 and m.conversation_id = $2 and c.user_id = $3 and m.role = 'assistant'
     limit 1`,
    [assistantMessageId, conversationId, userId],
  );
  assert.equal(replay.id, assistantMessageId);
  assert.equal(replay.content, 'recovered response');

  console.log('NEXA PostgreSQL chat-turn recovery integration test passed.');
} finally {
  if (userId) {
    try { await pool.query('delete from users where id = $1', [userId]); } catch {}
  }
  await pool.end();
}
