import type { PoolClient } from 'pg';
import { withTransaction } from '@/lib/db';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

export class IdempotencyError extends Error {
  code: 'INVALID_KEY' | 'KEY_REUSE_MISMATCH';

  constructor(code: 'INVALID_KEY' | 'KEY_REUSE_MISMATCH') {
    super(code);
    this.name = 'IdempotencyError';
    this.code = code;
  }
}

import { hashRequestBody, validateIdempotencyKey } from '@/lib/idempotency-core';

export { hashRequestBody } from '@/lib/idempotency-core';

export function getIdempotencyKey(request: Request) {
  const raw = request.headers.get('idempotency-key');
  if (!raw) return null;
  const key = validateIdempotencyKey(raw);
  if (!key) throw new IdempotencyError('INVALID_KEY');
  return key;
}

export type IdempotentResult = {
  status: number;
  body: unknown;
};

async function claimOrReplay(
  client: PoolClient,
  params: { userId: string; scope: string; key: string; requestHash: string },
) {
  await client.query(
    `delete from idempotency_keys
     where user_id = $1 and scope = $2 and idempotency_key = $3 and expires_at <= now()`,
    [params.userId, params.scope, params.key],
  );

  await client.query(
    `insert into idempotency_keys (user_id, scope, idempotency_key, request_hash, expires_at)
     values ($1, $2, $3, $4, now() + ($5 * interval '1 second'))
     on conflict (user_id, scope, idempotency_key) do nothing`,
    [params.userId, params.scope, params.key, params.requestHash, DEFAULT_TTL_SECONDS],
  );

  const existing = await client.query<{
    request_hash: string;
    response_status: number | null;
    response_body: unknown | null;
    expires_at: string;
  }>(
    `select request_hash, response_status, response_body, expires_at
     from idempotency_keys
     where user_id = $1 and scope = $2 and idempotency_key = $3
     for update`,
    [params.userId, params.scope, params.key],
  );

  const row = existing.rows[0];
  if (!row) throw new Error('Idempotency record could not be created.');
  if (row.request_hash !== params.requestHash) throw new IdempotencyError('KEY_REUSE_MISMATCH');

  if (row.response_status !== null) {
    return {
      replay: true,
      result: { status: row.response_status, body: row.response_body },
    } as const;
  }

  return { replay: false } as const;
}

export async function withIdempotency(
  params: {
    userId: string;
    scope: string;
    key: string | null;
    requestHash: string;
  },
  work: (client: PoolClient) => Promise<IdempotentResult>,
) {
  if (!params.key) {
    let result: IdempotentResult | null = null;
    await withTransaction(async (client) => {
      result = await work(client);
    });
    return { replay: false, result: result! };
  }

  let result: IdempotentResult | null = null;
  let replay = false;

  await withTransaction(async (client) => {
    const claim = await claimOrReplay(client, {
      userId: params.userId,
      scope: params.scope,
      key: params.key!,
      requestHash: params.requestHash,
    });

    if (claim.replay) {
      replay = true;
      result = claim.result;
      return;
    }

    result = await work(client);
    await client.query(
      `update idempotency_keys
       set response_status = $1, response_body = $2::jsonb
       where user_id = $3 and scope = $4 and idempotency_key = $5`,
      [result.status, JSON.stringify(result.body), params.userId, params.scope, params.key],
    );
  });

  return { replay, result: result! };
}

export function mapIdempotencyError(error: unknown) {
  if (!(error instanceof IdempotencyError)) return null;
  if (error.code === 'INVALID_KEY') return 'Idempotency-Key must be 8–255 characters using letters, numbers, dot, underscore, colon, or hyphen.';
  return 'This Idempotency-Key was already used with a different request.';
}
