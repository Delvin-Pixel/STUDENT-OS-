#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, migration, manifestText, readme] = await Promise.all([
  read('package.json'),
  read('db/044_supabase_data_api_isolation.sql'),
  read('db/migration-checksums.json'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);
const manifest = JSON.parse(manifestText);

assert.equal(pkg.name, 'nexa-1-82');
assert.equal(pkg.version, '1.82.0');
assert.equal(
  pkg.scripts['test:supabase-data-api-isolation'],
  'node scripts/test-supabase-data-api-isolation.mjs',
);
assert.match(pkg.scripts.test, /test:supabase-data-api-isolation/);
assert.match(readme, /NEXA 1\.79\.0 — Supabase Data API Isolation/);

assert.equal(
  manifest.migrations['044_supabase_data_api_isolation.sql'],
  '62fb9fda67a32e3b959d9ce03961b3ead463e536171062388e9fd745fbdfd097',
);

assert.match(migration, /revoke usage on schema public from public/);
assert.match(migration, /rolname = 'anon'/);
assert.match(migration, /rolname = 'authenticated'/);
assert.match(migration, /rolname = 'nexa_runtime'/);
assert.match(migration, /revoke all privileges on all tables in schema public from anon/);
assert.match(migration, /revoke all privileges on all tables in schema public from authenticated/);
assert.match(migration, /grant select, insert, update, delete on all tables in schema public to nexa_runtime/);
assert.match(migration, /grant execute on all functions in schema public to nexa_runtime/);
assert.match(migration, /current_user/);
assert.match(migration, /revoke execute on functions from public/);
assert.match(migration, /grant execute on functions to nexa_runtime/);

assert.doesNotMatch(migration, /for role supabase_admin/i);
assert.doesNotMatch(migration, /grant .* to anon/i);
assert.doesNotMatch(migration, /grant .* to authenticated/i);
assert.doesNotMatch(migration, /enable row level security/i);
assert.doesNotMatch(migration, /drop table|drop schema|truncate|delete from/i);

console.log('NEXA Supabase Data API isolation contract tests passed.');
