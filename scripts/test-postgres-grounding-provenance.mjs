#!/usr/bin/env node
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL grounding-provenance tests.');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
const userId = randomUUID();
const otherUserId = randomUUID();
const projectId = randomUUID();
const conversationId = randomUUID();
const otherConversationId = randomUUID();
const assistantMessageId = randomUUID();
const sourceId = randomUUID();

try {
  await client.query('begin');
  await client.query(`insert into users (id, email, name, password_hash, plan) values ($1,$2,'Grounding User','hash','premium'),($3,$4,'Other User','hash','free')`, [userId, `grounding-${userId}@example.invalid`, otherUserId, `grounding-${otherUserId}@example.invalid`]);
  await client.query(`insert into projects (id, user_id, name, description) values ($1,$2,'Grounded Project','Fixture')`, [projectId, userId]);
  await client.query(`insert into conversations (id, user_id, project_id, title) values ($1,$2,$3,'Grounded Conversation'),($4,$5,null,'Other Conversation')`, [conversationId,userId,projectId,otherConversationId,otherUserId]);
  await client.query(`insert into messages (id, conversation_id, role, content, metadata) values ($1,$2,'assistant','Grounded response [S1]','{}'::jsonb)`, [assistantMessageId,conversationId]);
  await client.query(`insert into assistant_message_sources (message_id,conversation_id,user_id,project_id,source_order,source_label,source_type,source_id,title,excerpt,retrieval,relevance) values ($1,$2,$3,$4,1,'S1','file',$5,'Deleted later.pdf','Durable source snapshot.','hybrid',3.2)`, [assistantMessageId,conversationId,userId,projectId,sourceId]);

  const stored = await client.query(`select source_label,title,excerpt,retrieval,source_id from assistant_message_sources where message_id=$1`, [assistantMessageId]);
  assert.equal(stored.rows[0]?.source_label, 'S1');
  assert.equal(stored.rows[0]?.title, 'Deleted later.pdf');
  assert.equal(stored.rows[0]?.retrieval, 'hybrid');
  assert.equal(stored.rows[0]?.source_id, sourceId);

  let ownerCode = null;
  await client.query('savepoint source_owner');
  try {
    await client.query(`insert into assistant_message_sources (message_id,conversation_id,user_id,source_order,source_label,source_type,title,excerpt) values ($1,$2,$3,2,'S2','memory','Bad owner','Must fail')`, [assistantMessageId,conversationId,otherUserId]);
  } catch (error) { ownerCode = error?.code ?? null; await client.query('rollback to savepoint source_owner'); }
  assert.equal(ownerCode, '23503', 'Source snapshots must be fenced to the conversation owner.');

  let labelCode = null;
  await client.query('savepoint source_label');
  try {
    await client.query(`insert into assistant_message_sources (message_id,conversation_id,user_id,source_order,source_label,source_type,title,excerpt) values ($1,$2,$3,2,'S99','memory','Bad label','Must fail')`, [assistantMessageId,conversationId,userId]);
  } catch (error) { labelCode = error?.code ?? null; await client.query('rollback to savepoint source_label'); }
  assert.equal(labelCode, '23514', 'Only bounded S1-S12 labels are valid.');

  await client.query('delete from messages where id=$1', [assistantMessageId]);
  const afterDelete = await client.query(`select count(*)::int as count from assistant_message_sources where message_id=$1`, [assistantMessageId]);
  assert.equal(afterDelete.rows[0]?.count, 0, 'Message deletion must cascade to source snapshots.');

  await client.query('rollback');
  console.log('NEXA PostgreSQL grounding-provenance integration tests passed.');
} finally { client.release(); await pool.end(); }
