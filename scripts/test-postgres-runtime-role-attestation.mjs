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
  await pool.query('alter default privileges in schema public revoke all on tables from nexa_runtime');
  await pool.query(
    'alter default privileges in schema public grant select, insert, update, delete on tables to nexa_runtime',
  );
  await pool.query('alter default privileges in schema public revoke all on sequences from nexa_runtime');
  await pool.query(
    'alter default privileges in schema public grant usage, select on sequences to nexa_runtime',
  );
  await pool.query('alter default privileges in schema public revoke all on functions from nexa_runtime');
  await pool.query(
    'alter default privileges in schema public grant execute on functions to nexa_runtime',
  );

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

  await pool.query('drop table if exists public.nexa_runtime_privilege_probe');
  await pool.query('create table public.nexa_runtime_privilege_probe(id integer)');
  await pool.query(
    'grant select, insert, update, delete on table public.nexa_runtime_privilege_probe to nexa_runtime',
  );
  await pool.query(
    'revoke truncate, references, trigger, maintain on table public.nexa_runtime_privilege_probe from nexa_runtime',
  );

  const exactTableBaseline = await queryNexaRuntimeRoleAttestation();
  assert.equal(exactTableBaseline.secure, true, JSON.stringify(exactTableBaseline));

  for (const [privilege, failedCheck] of [
    ['truncate', 'noTableTruncate'],
    ['references', 'noTableReferences'],
    ['trigger', 'noTableTrigger'],
    ['maintain', 'noTableMaintain'],
  ]) {
    await pool.query(
      `grant ${privilege} on table public.nexa_runtime_privilege_probe to nexa_runtime`,
    );
    const expanded = await queryNexaRuntimeRoleAttestation();
    assert.equal(expanded.secure, false, privilege);
    assert.ok(expanded.failedChecks.includes(failedCheck), privilege);

    await pool.query(
      `revoke ${privilege} on table public.nexa_runtime_privilege_probe from nexa_runtime`,
    );
    const exactAgain = await queryNexaRuntimeRoleAttestation();
    assert.equal(exactAgain.secure, true, JSON.stringify(exactAgain));
  }

  await pool.query('drop table public.nexa_runtime_privilege_probe');

  await pool.query('drop sequence if exists public.nexa_runtime_privilege_probe_seq');
  await pool.query('create sequence public.nexa_runtime_privilege_probe_seq');
  await pool.query(
    'grant usage, select on sequence public.nexa_runtime_privilege_probe_seq to nexa_runtime',
  );
  await pool.query(
    'revoke update on sequence public.nexa_runtime_privilege_probe_seq from nexa_runtime',
  );

  const exactSequenceBaseline = await queryNexaRuntimeRoleAttestation();
  assert.equal(exactSequenceBaseline.secure, true, JSON.stringify(exactSequenceBaseline));

  await pool.query(
    'grant update on sequence public.nexa_runtime_privilege_probe_seq to nexa_runtime',
  );
  const sequenceExpanded = await queryNexaRuntimeRoleAttestation();
  assert.equal(sequenceExpanded.secure, false);
  assert.ok(sequenceExpanded.failedChecks.includes('noSequenceUpdate'));

  await pool.query(
    'revoke update on sequence public.nexa_runtime_privilege_probe_seq from nexa_runtime',
  );
  const sequenceRestored = await queryNexaRuntimeRoleAttestation();
  assert.equal(sequenceRestored.secure, true, JSON.stringify(sequenceRestored));

  await pool.query('drop sequence public.nexa_runtime_privilege_probe_seq');

  console.log('NEXA PostgreSQL runtime role least-privilege attestation tests passed.');
} finally {
  await pool.query('revoke create on schema public from nexa_runtime').catch(() => {});
  await pool.query('drop table if exists public.nexa_runtime_ownership_probe').catch(() => {});
  await pool.query('drop function if exists public.nexa_runtime_security_definer_probe()').catch(() => {});
  await pool.query('drop table if exists public.nexa_runtime_privilege_probe').catch(() => {});
  await pool.query('drop sequence if exists public.nexa_runtime_privilege_probe_seq').catch(() => {});
  await pool.end();
}
