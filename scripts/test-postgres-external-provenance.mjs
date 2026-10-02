#!/usr/bin/env node
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL external-provenance tests.');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
const userId = randomUUID();
const otherUserId = randomUUID();
const conversationId = randomUUID();
const assistantMessageId = randomUUID();

try {
  await client.query('begin');
  await client.query(`insert into users (id,email,name,password_hash,plan) values ($1,$2,'External Source User','hash','premium'),($3,$4,'Other User','hash','free')`, [userId, `ext-${userId}@example.invalid`, otherUserId, `ext-${otherUserId}@example.invalid`]);
  await client.query(`insert into conversations (id,user_id,title) values ($1,$2,'External Source Conversation')`, [conversationId,userId]);
  await client.query(`insert into messages (id,conversation_id,role,content,metadata) values ($1,$2,'assistant','Web-grounded response','{}'::jsonb)`, [assistantMessageId,conversationId]);
  await client.query(`insert into assistant_message_external_sources (message_id,conversation_id,user_id,source_order,source_label,provider,source_url,title,excerpt) values ($1,$2,$3,1,'W1','tako','https://example.com/article','Example article','Bounded external source snapshot.')`, [assistantMessageId,conversationId,userId]);

  const stored = await client.query(`select source_label,provider,source_url,title,excerpt from assistant_message_external_sources where message_id=$1`, [assistantMessageId]);
  assert.equal(stored.rows[0]?.source_label, 'W1');
  assert.equal(stored.rows[0]?.provider, 'tako');
  assert.equal(stored.rows[0]?.source_url, 'https://example.com/article');

  let ownerCode = null;
  await client.query('savepoint bad_owner');
  try {
    await client.query(`insert into assistant_message_external_sources (message_id,conversation_id,user_id,source_order,source_label,provider,source_url,title,excerpt) values ($1,$2,$3,2,'W2','tako','https://example.com/owner','Bad owner','Must fail')`, [assistantMessageId,conversationId,otherUserId]);
  } catch (error) { ownerCode = error?.code ?? null; await client.query('rollback to savepoint bad_owner'); }
  assert.equal(ownerCode, '23503', 'External source snapshots must be fenced to the conversation owner.');

  let urlCode = null;
  await client.query('savepoint bad_url');
  try {
    await client.query(`insert into assistant_message_external_sources (message_id,conversation_id,user_id,source_order,source_label,provider,source_url,title,excerpt) values ($1,$2,$3,2,'W2','tako','javascript:alert(1)','Bad URL','Must fail')`, [assistantMessageId,conversationId,userId]);
  } catch (error) { urlCode = error?.code ?? null; await client.query('rollback to savepoint bad_url'); }
  assert.equal(urlCode, '23514', 'Only HTTP(S) source URLs may be persisted.');

  let labelCode = null;
  await client.query('savepoint bad_label');
  try {
    await client.query(`insert into assistant_message_external_sources (message_id,conversation_id,user_id,source_order,source_label,provider,source_url,title,excerpt) values ($1,$2,$3,2,'W99','tako','https://example.com/label','Bad label','Must fail')`, [assistantMessageId,conversationId,userId]);
  } catch (error) { labelCode = error?.code ?? null; await client.query('rollback to savepoint bad_label'); }
  assert.equal(labelCode, '23514', 'Only bounded W1-W8 labels are valid.');

  await client.query('delete from messages where id=$1', [assistantMessageId]);
  const afterDelete = await client.query(`select count(*)::int as count from assistant_message_external_sources where message_id=$1`, [assistantMessageId]);
  assert.equal(afterDelete.rows[0]?.count, 0, 'Message deletion must cascade external source snapshots.');

  await client.query('rollback');
  console.log('NEXA PostgreSQL external-source provenance integration tests passed.');
} finally { client.release(); await pool.end(); }
