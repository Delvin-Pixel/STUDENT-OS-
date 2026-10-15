#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [pkgText, migration, manifestText, readme] = await Promise.all([
  read('package.json'),
  read('db/043_public_rls_server_only.sql'),
  read('db/migration-checksums.json'),
  read('README.md'),
]);
const pkg = JSON.parse(pkgText);
const manifest = JSON.parse(manifestText);

assert.equal(pkg.name, 'nexa-1-71-1');
assert.equal(pkg.version, '1.71.1');
assert.equal(pkg.scripts['test:rls-hardening'], 'node scripts/test-rls-hardening.mjs');
assert.match(pkg.scripts.test, /test:rls-hardening/);
assert.match(pkg.scripts['verify:ci'], /test:postgres-rls-hardening/);
assert.match(readme, /NEXA 1\.71\.1 — Public Schema RLS Hardening/);

const enableMatches = migration.match(/enable row level security;/g) ?? [];
const policyMatches = migration.match(/create policy nexa_runtime_server_access/g) ?? [];
assert.equal(enableMatches.length, 32);
assert.equal(policyMatches.length, 32);
assert.match(migration, /using \(current_user = 'nexa_runtime'\)/);
assert.match(migration, /with check \(current_user = 'nexa_runtime'\)/);
assert.doesNotMatch(migration, /disable row level security/i);
assert.doesNotMatch(migration, /force row level security/i);
assert.doesNotMatch(migration, /to\s+(anon|authenticated)\b/i);
assert.doesNotMatch(migration, /using\s*\(true\)/i);
assert.doesNotMatch(migration, /with check\s*\(true\)/i);

const expectedTables = [
  'schema_migrations','users','sessions','conversations','messages','usage_daily','projects','memories',
  'memory_events','conversation_context','artifacts','workflows','workflow_steps','tool_runs','workflow_checkpoints',
  'rate_limit_buckets','security_audit_events','idempotency_keys','workflow_events','ai_runs','workflow_execution_leases',
  'workflow_execution_attempts','workflow_execution_attempt_events','chat_turns','project_files',
  'project_file_embedding_states','project_file_embedding_chunks','project_file_blobs','assistant_message_sources',
  'assistant_message_external_sources','student_os_bridge_requests','student_os_bridge_events',
];
for (const table of expectedTables) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  assert.match(migration, new RegExp(`create policy nexa_runtime_server_access\\n  on public\\.${table}`));
}

assert.equal(
  manifest.migrations['043_public_rls_server_only.sql'],
  '9baa8ab8928538bd86a77c28284b9d4fa7e683f9fadcac478c6f4ecc07e9a5ff',
);

console.log('NEXA public-schema RLS hardening contract tests passed.');
