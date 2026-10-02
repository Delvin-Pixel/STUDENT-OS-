#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const account = await readFile(new URL('../lib/account.ts', import.meta.url), 'utf8');
const route = await readFile(new URL('../app/api/account/route.ts', import.meta.url), 'utf8');
const exportRoute = await readFile(new URL('../app/api/account/export/route.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../db/017_account_privacy.sql', import.meta.url), 'utf8');
const component = await readFile(new URL('../components/account-panel.tsx', import.meta.url), 'utf8');

assert.match(account, /EXPORT_LIMIT_PER_COLLECTION = 25_000/);
assert.match(account, /EXPORT_LIMIT_TOTAL_RECORDS = 100_000/);
assert.match(account, /EXPORT_SCHEMA_VERSION = '1.23'/);
assert.match(account, /AccountCredentialError/);
assert.match(account, /delete from users where id = \$1/);
assert.match(account, /account_deleted/);
assert.match(account, /data_exported/);
assert.match(account, /fetchCollection\(client, 'ai_runs'/);
assert.match(account, /request_id, execution_attempt_id, tool_name, risk, status, attempt, input_hash, blocked_reason/);
assert.match(account, /request_id, execution_attempt_id, model, status/);
assert.match(route, /DELETE MY ACCOUNT/);
assert.match(route, /deleteAccount/);
assert.match(exportRoute, /Content-Disposition/);
assert.match(exportRoute, /AccountExportLimitError/);
assert.match(migration, /data_exported/);
assert.match(migration, /account_deleted/);
assert.match(component, /Export my data/);
assert.match(component, /Permanently delete/);
assert.match(component, /Account email/);
console.log('NEXA account privacy contract tests passed.');
