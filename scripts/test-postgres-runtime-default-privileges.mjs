#!/usr/bin/env node
import assert from 'node:assert/strict';
import pg from 'pg';
import { queryNexaRuntimeRoleAttestation } from './attest-nexa-runtime-role.mjs';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for NEXA runtime default-privilege PostgreSQL testing.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});

async function restoreExactDefaults() {
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
}

try {
  await restoreExactDefaults();

  const baseline = await queryNexaRuntimeRoleAttestation();
  assert.equal(baseline.secure, true, JSON.stringify(baseline));
  assert.ok(baseline.checks.defaultTablePrivilegesConfigured);
  assert.ok(baseline.checks.defaultSequencePrivilegesConfigured);
  assert.ok(baseline.checks.defaultFunctionPrivilegesConfigured);
  assert.ok(baseline.checks.exactDefaultPrivileges);
  assert.ok(baseline.checks.noDefaultGrantOptions);
  assert.ok(baseline.checks.noDefaultPrivilegesOutsidePublic);

  await pool.query(
    'alter default privileges in schema public grant truncate on tables to nexa_runtime',
  );
  const tableExpanded = await queryNexaRuntimeRoleAttestation();
  assert.equal(tableExpanded.secure, false);
  assert.ok(tableExpanded.failedChecks.includes('exactDefaultPrivileges'));
  await restoreExactDefaults();

  await pool.query(
    'alter default privileges in schema public grant update on sequences to nexa_runtime',
  );
  const sequenceExpanded = await queryNexaRuntimeRoleAttestation();
  assert.equal(sequenceExpanded.secure, false);
  assert.ok(sequenceExpanded.failedChecks.includes('exactDefaultPrivileges'));
  await restoreExactDefaults();

  await pool.query(
    'alter default privileges in schema public grant select on tables to nexa_runtime with grant option',
  );
  const grantOptionExpanded = await queryNexaRuntimeRoleAttestation();
  assert.equal(grantOptionExpanded.secure, false);
  assert.ok(grantOptionExpanded.failedChecks.includes('noDefaultGrantOptions'));
  assert.ok(grantOptionExpanded.failedChecks.includes('exactDefaultPrivileges'));
  await restoreExactDefaults();

  await pool.query('drop schema if exists nexa_default_privilege_probe_schema cascade');
  await pool.query('create schema nexa_default_privilege_probe_schema');
  await pool.query(
    'alter default privileges in schema nexa_default_privilege_probe_schema grant select, insert, update, delete on tables to nexa_runtime',
  );
  const outsidePublic = await queryNexaRuntimeRoleAttestation();
  assert.equal(outsidePublic.secure, false);
  assert.ok(outsidePublic.failedChecks.includes('noDefaultPrivilegesOutsidePublic'));
  assert.ok(outsidePublic.failedChecks.includes('exactDefaultPrivileges'));
  await pool.query(
    'alter default privileges in schema nexa_default_privilege_probe_schema revoke all on tables from nexa_runtime',
  );
  await pool.query('drop schema nexa_default_privilege_probe_schema');

  await restoreExactDefaults();
  await pool.query(
    'alter default privileges in schema public revoke execute on functions from nexa_runtime',
  );
  const functionMissing = await queryNexaRuntimeRoleAttestation();
  assert.equal(functionMissing.secure, false);
  assert.ok(functionMissing.failedChecks.includes('defaultFunctionPrivilegesConfigured'));

  await restoreExactDefaults();
  const restored = await queryNexaRuntimeRoleAttestation();
  assert.equal(restored.secure, true, JSON.stringify(restored));

  console.log('NEXA PostgreSQL runtime default privilege tests passed.');
} finally {
  await restoreExactDefaults().catch(() => {});
  await pool.query(
    'alter default privileges in schema nexa_default_privilege_probe_schema revoke all on tables from nexa_runtime',
  ).catch(() => {});
  await pool.query('drop schema if exists nexa_default_privilege_probe_schema cascade').catch(() => {});
  await pool.end();
}
