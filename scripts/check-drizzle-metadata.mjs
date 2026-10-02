import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const drizzleDir = "drizzle";
const journalPath = join(drizzleDir, "meta", "_journal.json");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
assert.ok(Array.isArray(journal.entries), "Drizzle journal entries missing");

const seen = new Set();
for (const [position, entry] of journal.entries.entries()) {
  assert.equal(
    entry.idx,
    position,
    `Drizzle journal is non-contiguous at position ${position}`
  );
  assert.ok(!seen.has(entry.tag), `Duplicate migration tag: ${entry.tag}`);
  seen.add(entry.tag);

  const prefix = String(entry.idx).padStart(4, "0");
  const sql = join(drizzleDir, `${entry.tag}.sql`);
  const snapshot = join(drizzleDir, "meta", `${prefix}_snapshot.json`);
  assert.ok(existsSync(sql), `Missing migration SQL: ${sql}`);
  assert.ok(existsSync(snapshot), `Missing snapshot: ${snapshot}`);
  JSON.parse(readFileSync(snapshot, "utf8"));
}

assert.ok(
  journal.entries.some(entry => entry.tag === "0014_student_os_entitlements"),
  "B58 entitlement migration missing"
);
const entitlementSnapshot = JSON.parse(
  readFileSync("drizzle/meta/0014_snapshot.json", "utf8")
);
const tables = Object.values(entitlementSnapshot.tables ?? {});
assert.ok(
  tables.some(table => table?.name === "subscriptions"),
  "0014 snapshot does not contain subscriptions"
);

console.log(
  `Drizzle metadata OK: ${journal.entries.length} migrations validated.`
);
