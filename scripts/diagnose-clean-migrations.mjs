import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const sourceUrl = new URL(process.env.DATABASE_URL);
const database = `studentos_migration_diagnostic_${process.pid}`;
const admin = await mysql.createConnection({
  host: sourceUrl.hostname,
  port: sourceUrl.port ? Number(sourceUrl.port) : 3306,
  user: decodeURIComponent(sourceUrl.username),
  password: decodeURIComponent(sourceUrl.password),
});

try {
  await admin.query(`CREATE DATABASE \`${database}\``);
  const db = await mysql.createConnection({
    host: sourceUrl.hostname,
    port: sourceUrl.port ? Number(sourceUrl.port) : 3306,
    user: decodeURIComponent(sourceUrl.username),
    password: decodeURIComponent(sourceUrl.password),
    database,
  });
  try {
    const root = path.resolve("drizzle");
    const files = (await fs.readdir(root))
      .filter(file => /^\d+_.+\.sql$/.test(file))
      .sort();
    for (const file of files) {
      const sql = await fs.readFile(path.join(root, file), "utf8");
      const statements = sql
        .split("--> statement-breakpoint")
        .map(statement => statement.trim())
        .filter(Boolean);
      for (const [index, statement] of statements.entries()) {
        try {
          await db.query(statement);
        } catch (error) {
          console.error(`Migration ${file}, statement ${index + 1}/${statements.length} failed.`);
          console.error(statement);
          console.error(error);
          throw error;
        }
      }
    }
    console.log(`Diagnostic migration pass: ${files.length} migration files applied.`);
  } finally {
    await db.end();
  }
} finally {
  await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await admin.end();
}
