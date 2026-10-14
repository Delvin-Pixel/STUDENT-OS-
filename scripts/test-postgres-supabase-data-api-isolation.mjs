#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for Supabase Data API isolation integration testing.');
  process.exit(1);
}

const migration = await readFile(
  new URL('../db/044_supabase_data_api_isolation.sql', import.meta.url),
  'utf8',
);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});

try {
  await pool.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname='anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then
        create role authenticated nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname='nexa_runtime') then
        create role nexa_runtime login;
      end if;
    end
    $$;
  `);

  await pool.query('grant usage on schema public to anon, authenticated');
  await pool.query('grant all privileges on all tables in schema public to anon, authenticated');
  await pool.query('grant all privileges on all sequences in schema public to anon, authenticated');

  await pool.query(migration);

  const current = await pool.query(`
    select
      count(*)::int as public_tables,
      count(*) filter (
        where has_table_privilege('anon', c.oid, 'select,insert,update,delete')
      )::int as anon_full_crud,
      count(*) filter (
        where has_table_privilege('authenticated', c.oid, 'select,insert,update,delete')
      )::int as authenticated_full_crud,
      count(*) filter (
        where has_table_privilege('nexa_runtime', c.oid, 'select,insert,update,delete')
      )::int as runtime_full_crud,
      has_schema_privilege('anon','public','usage') as anon_schema_usage,
      has_schema_privilege('authenticated','public','usage') as authenticated_schema_usage,
      has_schema_privilege('nexa_runtime','public','usage') as runtime_schema_usage
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r';
  `);
  const row = current.rows[0];
  assert.equal(Number(row.anon_full_crud), 0);
  assert.equal(Number(row.authenticated_full_crud), 0);
  assert.equal(Number(row.runtime_full_crud), Number(row.public_tables));
  assert.equal(row.anon_schema_usage, false);
  assert.equal(row.authenticated_schema_usage, false);
  assert.equal(row.runtime_schema_usage, true);

  await pool.query('create table public.nexa_security_probe(id bigserial primary key, value text)');
  await pool.query('create sequence public.nexa_security_probe_sequence');
  await pool.query(`
    create function public.nexa_security_probe_fn()
    returns integer
    language sql
    stable
    as $$ select 1 $$;
  `);

  const future = await pool.query(`
    select
      has_table_privilege('anon','public.nexa_security_probe','select,insert,update,delete') as anon_table,
      has_table_privilege('authenticated','public.nexa_security_probe','select,insert,update,delete') as authenticated_table,
      has_table_privilege('nexa_runtime','public.nexa_security_probe','select,insert,update,delete') as runtime_table,
      has_sequence_privilege('anon','public.nexa_security_probe_sequence','usage,select') as anon_sequence,
      has_sequence_privilege('authenticated','public.nexa_security_probe_sequence','usage,select') as authenticated_sequence,
      has_sequence_privilege('nexa_runtime','public.nexa_security_probe_sequence','usage,select') as runtime_sequence,
      has_function_privilege('nexa_runtime','public.nexa_security_probe_fn()','execute') as runtime_function;
  `);
  const f = future.rows[0];
  assert.equal(f.anon_table, false);
  assert.equal(f.authenticated_table, false);
  assert.equal(f.runtime_table, true);
  assert.equal(f.anon_sequence, false);
  assert.equal(f.authenticated_sequence, false);
  assert.equal(f.runtime_sequence, true);
  assert.equal(f.runtime_function, true);

  for (const blockedRole of ['anon', 'authenticated']) {
    const client = await pool.connect();
    try {
      await client.query(`set role ${blockedRole}`);
      await assert.rejects(
        () => client.query('select * from public.nexa_security_probe'),
        (error) => error?.code === '42501',
      );
      await assert.rejects(
        () => client.query('select public.nexa_security_probe_fn()'),
        (error) => error?.code === '42501',
      );
    } finally {
      await client.query('reset role').catch(() => {});
      client.release();
    }
  }

  const runtimeClient = await pool.connect();
  try {
    await runtimeClient.query('set role nexa_runtime');
    const inserted = await runtimeClient.query(
      "insert into public.nexa_security_probe(value) values ('ok') returning id, value",
    );
    assert.equal(inserted.rows[0].value, 'ok');
    const called = await runtimeClient.query('select public.nexa_security_probe_fn() as value');
    assert.equal(Number(called.rows[0].value), 1);
  } finally {
    await runtimeClient.query('reset role').catch(() => {});
    runtimeClient.release();
  }

  console.log('NEXA PostgreSQL Supabase Data API isolation tests passed.');
} finally {
  await pool.query('drop function if exists public.nexa_security_probe_fn()').catch(() => {});
  await pool.query('drop sequence if exists public.nexa_security_probe_sequence').catch(() => {});
  await pool.query('drop table if exists public.nexa_security_probe').catch(() => {});
  await pool.end();
}
