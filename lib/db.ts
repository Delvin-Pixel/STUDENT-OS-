import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const globalForDb = globalThis as typeof globalThis & {
  nexaDb?: Pool;
};

function boundedInteger(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function databaseConnectionOptions(connectionString: string) {
  const ca = process.env.NEXA_DB_SSL_CA?.replace(/\\n/g, '\n').trim();
  const allowUnverified = process.env.NEXA_DB_SSL_ALLOW_UNVERIFIED === 'true';

  if (!ca && !allowUnverified) {
    return { connectionString };
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return { connectionString };
  }

  const isSupabasePooler = url.hostname.toLowerCase().endsWith('.pooler.supabase.com');
  if (!isSupabasePooler) {
    return { connectionString };
  }

  // node-postgres lets SSL query parameters in connectionString replace an
  // explicit ssl object. Remove them before supplying the TLS policy below.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) {
    url.searchParams.delete(key);
  }

  if (ca) {
    return {
      connectionString: url.toString(),
      ssl: { ca, rejectUnauthorized: true },
    };
  }

  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  };
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const max = boundedInteger('NEXA_DB_POOL_MAX', process.env.NODE_ENV === 'production' ? 3 : 5, 1, 20);
  const statementTimeout = boundedInteger('NEXA_DB_STATEMENT_TIMEOUT_MS', 15_000, 1_000, 120_000);

  return new Pool({
    ...databaseConnectionOptions(connectionString),
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: statementTimeout,
  });
}

export const db = globalForDb.nexaDb ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.nexaDb = db;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return db.query<T>(text, values);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    try { await client.query('rollback'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
