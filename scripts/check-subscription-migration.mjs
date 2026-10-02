import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the migration schema smoke test"
  );
}

const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [tables] = await db.query("SHOW TABLES LIKE 'subscriptions'");
  if (!Array.isArray(tables) || tables.length !== 1) {
    throw new Error("subscriptions table missing after migration");
  }

  const [indexes] = await db.query("SHOW INDEX FROM subscriptions");
  const names = new Set(indexes.map(row => row.Key_name));
  for (const required of [
    "subscriptions_owner_unique",
    "subscriptions_provider_subscription_unique",
    "subscriptions_status_period_idx",
  ]) {
    if (!names.has(required))
      throw new Error(`subscriptions index missing: ${required}`);
  }

  console.log("B58 entitlement migration smoke test passed.");
} finally {
  await db.end();
}
