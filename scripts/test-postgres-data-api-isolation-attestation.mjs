#!/usr/bin/env node
import assert from 'node:assert/strict';
import pg from 'pg';
import {
  queryNexaDataApiIsolation,
} from './attest-supabase-data-api-isolation.mjs';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for Data API isolation PostgreSQL testing.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});

async function restoreIsolation() {
  await pool.query('revoke usage, create on schema public from public').catch(() => {});
  for (const role of ['anon', 'authenticated']) {
    await pool.query(`revoke usage, create on schema public from ${role}`).catch(() => {});
    await pool.query(`revoke all privileges on all tables in schema public from ${role}`).catch(() => {});
    await pool.query(`revoke all privileges on all sequences in schema public from ${role}`).catch(() => {});
    await pool.query(`revoke execute on all functions in schema public from ${role}`).catch(() => {});
    await pool.query(`alter default privileges in schema public revoke all on tables from ${role}`).catch(() => {});
    await pool.query(`alter default privileges in schema public revoke all on sequences from ${role}`).catch(() => {});
    await pool.query(`alter default privileges in schema public revoke execute on functions from ${role}`).catch(() => {});
  }
  await pool.query('revoke all privileges on all tables in schema public from public').catch(() => {});
  await pool.query('revoke all privileges on all sequences in schema public from public').catch(() => {});
  await pool.query('revoke execute on all functions in schema public from public').catch(() => {});
  await pool.query('alter default privileges in schema public revoke all on tables from public').catch(() => {});
  await pool.query('alter default privileges in schema public revoke all on sequences from public').catch(() => {});
  await pool.query('alter default privileges in schema public revoke execute on functions from public').catch(() => {});
  await pool.query('alter default privileges revoke execute on functions from public').catch(() => {});
}

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
    end
    $$;
  `);
  await restoreIsolation();

  const baseline = await queryNexaDataApiIsolation();
  assert.equal(baseline.status, 'isolated', JSON.stringify(baseline));
  assert.equal(baseline.evidence.currentSchemaExposures, 0);
  assert.equal(baseline.evidence.currentTableExposures, 0);
  assert.equal(baseline.evidence.currentSequenceExposures, 0);
  assert.equal(baseline.evidence.currentFunctionExposures, 0);
  assert.equal(baseline.evidence.publicDefaultAclExposures, 0);

  await pool.query('grant usage on schema public to anon');
  const schemaExposed = await queryNexaDataApiIsolation();
  assert.equal(schemaExposed.status, 'exposed');
  assert.ok(schemaExposed.evidence.currentSchemaExposures > 0);
  await pool.query('revoke usage on schema public from anon');

  await pool.query('drop table if exists public.nexa_data_api_attestation_probe');
  await pool.query('create table public.nexa_data_api_attestation_probe(id integer)');
  await pool.query('grant select on table public.nexa_data_api_attestation_probe to authenticated');
  const tableExposed = await queryNexaDataApiIsolation();
  assert.equal(tableExposed.status, 'exposed');
  assert.ok(tableExposed.evidence.currentTableExposures > 0);
  await pool.query('revoke all on table public.nexa_data_api_attestation_probe from authenticated');
  await pool.query('drop table public.nexa_data_api_attestation_probe');

  const currentRestored = await queryNexaDataApiIsolation();
  assert.equal(currentRestored.status, 'isolated', JSON.stringify(currentRestored));

  await pool.query(
    'alter default privileges in schema public grant select on tables to anon',
  );
  const tableDefaultRisk = await queryNexaDataApiIsolation();
  assert.equal(tableDefaultRisk.status, 'future-default-risk');
  assert.equal(tableDefaultRisk.evidence.currentTableExposures, 0);
  assert.ok(tableDefaultRisk.evidence.publicDefaultAclExposures > 0);
  await pool.query(
    'alter default privileges in schema public revoke all on tables from anon',
  );

  await pool.query(
    'alter default privileges in schema public grant execute on functions to authenticated',
  );
  const functionDefaultRisk = await queryNexaDataApiIsolation();
  assert.equal(functionDefaultRisk.status, 'future-default-risk');
  assert.ok(functionDefaultRisk.evidence.publicDefaultAclExposures > 0);
  await pool.query(
    'alter default privileges in schema public revoke execute on functions from authenticated',
  );

  await restoreIsolation();
  const restored = await queryNexaDataApiIsolation();
  assert.equal(restored.status, 'isolated', JSON.stringify(restored));

  console.log('NEXA PostgreSQL Supabase Data API exposure attestation tests passed.');
} finally {
  await restoreIsolation().catch(() => {});
  await pool.query('drop table if exists public.nexa_data_api_attestation_probe').catch(() => {});
  await pool.end();
}
