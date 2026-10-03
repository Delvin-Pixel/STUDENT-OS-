#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for Student OS bridge admission integration testing.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});

const prefix = `nexa-bridge-admission-${randomUUID()}`;

async function consume(key, limit, windowSeconds) {
  const size = Math.max(1, windowSeconds) * 1000;
  const start = new Date(Math.floor(Date.now() / size) * size);
  const resetAt = new Date(start.getTime() + windowSeconds * 1000);

  await pool.query('delete from rate_limit_buckets where bucket_key = $1 and expires_at <= now()', [key]);
  const result = await pool.query(
    `insert into rate_limit_buckets (bucket_key, window_start, request_count, expires_at)
     values ($1, $2, 1, $3)
     on conflict (bucket_key, window_start)
     do update set request_count = rate_limit_buckets.request_count + 1,
                   expires_at = excluded.expires_at
     where rate_limit_buckets.request_count < $4
     returning request_count`,
    [key, start, resetAt, limit],
  );
  return result.rows[0]?.request_count ?? null;
}

try {
  const migrated = await pool.query(
    "select version from schema_migrations where version = '010_production_readiness.sql'",
  );
  assert.equal(migrated.rows.length, 1, 'Migration 010 must be applied before bridge admission tests.');

  const userMinuteKey = `${prefix}:user-minute`;
  assert.equal(await consume(userMinuteKey, 2, 60), 1);
  assert.equal(await consume(userMinuteKey, 2, 60), 2);
  assert.equal(await consume(userMinuteKey, 2, 60), null, 'Third request must be rejected once the bucket reaches its limit.');

  const globalKey = `${prefix}:global-minute`;
  const userHourKey = `${prefix}:user-hour`;
  assert.equal(await consume(globalKey, 1, 60), 1);
  assert.equal(await consume(userHourKey, 1, 3600), 1);
  assert.equal(await consume(globalKey, 1, 60), null);
  assert.equal(await consume(userHourKey, 1, 3600), null);

  const independent = await pool.query(
    `select bucket_key, request_count
     from rate_limit_buckets
     where bucket_key = any($1::text[])
     order by bucket_key`,
    [[userMinuteKey, globalKey, userHourKey]],
  );
  assert.equal(independent.rows.length, 3, 'Global, minute-user, and hour-user ceilings must remain independent durable buckets.');
  assert.deepEqual(
    independent.rows.map((row) => Number(row.request_count)).sort((a, b) => a - b),
    [1, 1, 2],
  );

  await pool.query(
    `update rate_limit_buckets
     set expires_at = now() - interval '1 second'
     where bucket_key = $1`,
    [globalKey],
  );
  assert.equal(await consume(globalKey, 1, 60), 1, 'An expired bridge bucket must be removable and reusable.');

  console.log('NEXA PostgreSQL Student OS bridge admission integration tests passed.');
} finally {
  try {
    await pool.query('delete from rate_limit_buckets where bucket_key like $1', [`${prefix}%`]);
  } catch {}
  await pool.end();
}
