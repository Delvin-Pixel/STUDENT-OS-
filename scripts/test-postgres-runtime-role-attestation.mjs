#!/usr/bin/env node
import assert from 'node:assert/strict';
import pg from 'pg';
import { queryNexaRuntimeRoleAttestation } from './attest-nexa-runtime-role.mjs';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for NEXA runtime-role PostgreSQL testing.');
  process.exit(1);
}

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
      if not exists (select 1 from pg_roles where rolname='nexa_runtime') then
        create role nexa_runtime login nosuperuser nocreaterole nocreatedb noreplication nobypassrls;
      end if;
    end
    $$;
  `);
  await pool.query('alter role nexa_runtime login nosuperuser nocreaterole nocreatedb noreplication nobypassrls');
  await pool.query('revoke create on schema public from nexa_runtime');
  await pool.query(`revoke create on database "${(await pool.query('select current_database() as name')).rows[0].name}" from nexa_runtime`);
  await pool.query('grant usage on schema public to nexa_runtime');
  await pool.query('grant select, insert, update, delete on all tables in schema public to nexa_runtime');
  await pool.query('grant usage, select on all sequences in schema public to nexa_runtime');
  await pool.query('grant execute on all functions in schema public to nexa_runtime');

  const memberships = await pool.query(`
    select granted.rolname
    from pg_auth_members m
    join pg_roles member_role on member_role.oid=m.member
    join pg_roles granted on granted.oid=m.roleid
    where member_role.rolname='nexa_runtime'
  `);
  for (const row of memberships.rows) {
    await pool.query(`revoke ${row.rolname} from nexa_runtime`);
  }

  const secure = await queryNexaRuntimeRoleAttestation();
  assert.equal(secure.secure, true, JSON.stringify(secure));
  assert.deepEqual([...secure.failedChecks], []);

  await pool.query('grant create on schema public to nexa_runtime');
  const widened = await queryNexaRuntimeRoleAttestation();
  assert.equal(widened.secure, false);
  assert.ok(widened.failedChecks.includes('noSchemaCreate'));

  await pool.query('revoke create on schema public from nexa_runtime');
  const restored = await queryNexaRuntimeRoleAttestation();
  assert.equal(restored.secure, true, JSON.stringify(restored));

  await pool.query('drop table if exists public.nexa_runtime_ownership_probe');
  await pool.query('create table public.nexa_runtime_ownership_probe(id integer)');
  await pool.query('alter table public.nexa_runtime_ownership_probe owner to nexa_runtime');
  const owned = await queryNexaRuntimeRoleAttestation();
  assert.equal(owned.secure, false);
  assert.ok(owned.failedChecks.includes('noPublicRelationOwnership'));

  await pool.query('drop table public.nexa_runtime_ownership_probe');
  const ownershipRestored = await queryNexaRuntimeRoleAttestation();
  assert.equal(ownershipRestored.secure, true, JSON.stringify(ownershipRestored));

  await pool.query('drop function if exists public.nexa_runtime_security_definer_probe()');
  await pool.query(`
    create function public.nexa_runtime_security_definer_probe()
    returns integer
    language sql
    security definer
    as 'select 1'
  `);
  await pool.query('grant execute on function public.nexa_runtime_security_definer_probe() to nexa_runtime');
  const definer = await queryNexaRuntimeRoleAttestation();
  assert.equal(definer.secure, false);
  assert.ok(definer.failedChecks.includes('noExecutableSecurityDefinerFunctions'));

  await pool.query('alter function public.nexa_runtime_security_definer_probe() security invoker');
  const invokerRestored = await queryNexaRuntimeRoleAttestation();
  assert.equal(invokerRestored.secure, true, JSON.stringify(invokerRestored));

  await pool.query('drop function public.nexa_runtime_security_definer_probe()');

  console.log('NEXA PostgreSQL runtime role least-privilege attestation tests passed.');
} finally {
  await pool.query('revoke create on schema public from nexa_runtime').catch(() => {});
  await pool.query('drop table if exists public.nexa_runtime_ownership_probe').catch(() => {});
  await pool.query('drop function if exists public.nexa_runtime_security_definer_probe()').catch(() => {});
  await pool.end();
}
