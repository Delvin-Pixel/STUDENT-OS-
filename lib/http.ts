import { randomUUID } from 'node:crypto';

const requestIds = new WeakMap<Request, string>();

export class RequestBodyError extends Error {
  code: 'REQUEST_BODY_TOO_LARGE' | 'INVALID_JSON' | 'INVALID_CONTENT_TYPE';

  constructor(code: 'REQUEST_BODY_TOO_LARGE' | 'INVALID_JSON' | 'INVALID_CONTENT_TYPE') {
    super(code);
    this.name = 'RequestBodyError';
    this.code = code;
  }
}

export function getRequestId(request: Request) {
  const existing = requestIds.get(request);
  if (existing) return existing;
  const generated = randomUUID();
  requestIds.set(request, generated);
  return generated;
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit & { requestId?: string } = {},
) {
  const headers = new Headers(init.headers);
  if (init.requestId) headers.set('X-Request-Id', init.requestId);
  return Response.json(body, { ...init, headers });
}

export async function readJsonBody<T = Record<string, unknown>>(
  request: Request,
  maxBytes: number,
): Promise<T> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json' && !contentType?.endsWith('+json')) {
    throw new RequestBodyError('INVALID_CONTENT_TYPE');
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const declared = Number(contentLength);
    if (!Number.isFinite(declared) || declared < 0 || declared > maxBytes) {
      throw new RequestBodyError('REQUEST_BODY_TOO_LARGE');
    }
  }

  const stream = request.body;
  if (!stream) throw new RequestBodyError('INVALID_JSON');

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError('REQUEST_BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new RequestBodyError('INVALID_JSON');
  }
}

export function mapBodyError(error: unknown) {
  if (!(error instanceof RequestBodyError)) return null;
  if (error.code === 'REQUEST_BODY_TOO_LARGE') return 'Request body is too large.';
  if (error.code === 'INVALID_CONTENT_TYPE') return 'Content-Type must be application/json.';
  return 'Request body must be valid JSON.';
}
