#!/usr/bin/env node
import assert from 'node:assert/strict';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for RLS hardening integration testing.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});

const client = await pool.connect();
try {
  const migration = await client.query(
    `select sha256 from schema_migrations where version = '043_public_rls_server_only.sql'`,
  );
  assert.equal(migration.rows.length, 1);
  assert.equal(
    migration.rows[0].sha256,
    '9baa8ab8928538bd86a77c28284b9d4fa7e683f9fadcac478c6f4ecc07e9a5ff',
  );

  const rls = await client.query(
    `select c.relname as table_name, c.relrowsecurity as rls_enabled
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname`,
  );
  assert.equal(rls.rows.length, 32);
  assert.ok(rls.rows.every((row) => row.rls_enabled === true));

  const policies = await client.query(
    `select tablename, policyname, cmd, roles, qual, with_check
       from pg_policies
      where schemaname = 'public'
        and policyname = 'nexa_runtime_server_access'
      order by tablename`,
  );
  assert.equal(policies.rows.length, 32);
  for (const row of policies.rows) {
    assert.equal(row.cmd, 'ALL');
    const roleText = Array.isArray(row.roles) ? row.roles.join(',') : String(row.roles ?? '');
    assert.match(roleText, /public/i);
    assert.match(row.qual ?? '', /CURRENT_USER.*nexa_runtime|current_user.*nexa_runtime/i);
    assert.match(row.with_check ?? '', /CURRENT_USER.*nexa_runtime|current_user.*nexa_runtime/i);
  }

  await client.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'nexa_runtime') then
        create role nexa_runtime nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
    end
    $$;
    grant usage on schema public to nexa_runtime, anon, authenticated;
    grant select, insert, update, delete on table public.schema_migrations to nexa_runtime, anon, authenticated;
  `);

  await client.query('begin');
  await client.query('set local role nexa_runtime');
  const runtimeRows = await client.query('select count(*)::int as count from public.schema_migrations');
  assert.equal(runtimeRows.rows[0].count, 43);
  await client.query(
    `insert into public.schema_migrations(version, sha256, applied_at)
     values ('rls-test-runtime', 'test-runtime', now())`,
  );
  await client.query('rollback');

  for (const role of ['anon', 'authenticated']) {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    const rows = await client.query('select count(*)::int as count from public.schema_migrations');
    assert.equal(rows.rows[0].count, 0, `${role} must see zero rows through RLS`);
    await assert.rejects(
      () => client.query(
        `insert into public.schema_migrations(version, sha256, applied_at)
         values ($1, 'blocked', now())`,
        [`rls-test-${role}`],
      ),
      (error) => error?.code === '42501',
    );
    await client.query('rollback');
  }

  console.log('NEXA PostgreSQL RLS hardening integration tests passed.');
} finally {
  client.release();
  await pool.end();
}
