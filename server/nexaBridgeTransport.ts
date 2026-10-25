/**
 * Track B: isolated, server-only NEXA transport prototype.
 *
 * No route calls this module until a separately reviewed authenticated
 * account-owner binding and feature gate have been integrated.
 * Successful model output is advisory text, never academic evidence or mastery.
 */
import { createHash, randomUUID } from "node:crypto";

export const NEXA_BRIDGE_VERSION = "1.0" as const;
export const NEXA_PROVIDER_VERSION = "1.0" as const;
export const NEXA_BINDING_VERSION = "sha256-v1" as const;
export const NEXA_ACADEMIC_AUTHORITY =
  "student-os-learning-intelligence" as const;

const MAX_REQUEST_BYTES = 48 * 1024;
const MAX_RESPONSE_BYTES = 50_000;
const MAX_ANSWER_CHARS = 8_000;
const CAPABILITIES = [
  "chat",
  "explain",
  "tutor",
  "generateMaterial",
  "generateQuiz",
  "coach",
] as const;

export type NexaBridgeCapability = (typeof CAPABILITIES)[number];
export type NexaBridgeAcademicContext = Readonly<{
  authority: typeof NEXA_ACADEMIC_AUTHORITY;
  snapshotId?: string | null;
  evidence: readonly string[];
  constraints?: readonly string[];
}>;

/** MUST originate from verified server authentication, never request JSON. */
export type NexaBridgeSubject = Readonly<{ userId: string }>;

export type NexaBridgeConfiguration = Readonly<{
  baseUrl: string;
  secret: string;
  timeoutMs?: number;
  allowLocalHttp?: boolean;
}>;

export type NexaBridgeFailureReason =
  | "disabled"
  | "invalid_request"
  | "incompatible"
  | "unauthorized"
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "cancelled"
  | "malformed_response";

export type NexaBridgeOutcome =
  | Readonly<{
      ok: true;
      answer: string;
      requestId: string;
      capability: NexaBridgeCapability;
      advisoryOnly: true;
    }>
  | Readonly<{
      ok: false;
      reason: NexaBridgeFailureReason;
    }>;

export type NexaBridgeCall = Readonly<{
  subject: NexaBridgeSubject;
  prompt: string;
  capability: NexaBridgeCapability;
  academicContext?: NexaBridgeAcademicContext;
  configuration: NexaBridgeConfiguration | null;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}>;

type NormalizedContext = Readonly<{
  authority: typeof NEXA_ACADEMIC_AUTHORITY;
  snapshotId: string | null;
  evidence: readonly string[];
  constraints: readonly string[];
}>;

function fail(reason: NexaBridgeFailureReason): NexaBridgeOutcome {
  return { ok: false, reason };
}

function normalizeString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function normalizeList(
  value: unknown,
  maxItems: number,
  maxChars: number
): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const values: string[] = [];
  for (const item of value) {
    const normalized = normalizeString(item, maxChars);
    if (!normalized) return null;
    values.push(normalized);
  }
  return values;
}

function normalizeContext(
  context: NexaBridgeAcademicContext | undefined
): NormalizedContext | null | false {
  if (context === undefined) return null;
  if (!context || context.authority !== NEXA_ACADEMIC_AUTHORITY) return false;
  const snapshotId =
    context.snapshotId === undefined ||
    context.snapshotId === null ||
    context.snapshotId === ""
      ? null
      : normalizeString(context.snapshotId, 128);
  if (context.snapshotId && !snapshotId) return false;
  const evidence = normalizeList(context.evidence, 16, 1_200);
  const constraints = normalizeList(context.constraints ?? [], 12, 600);
  if (!evidence || !constraints) return false;
  return {
    authority: NEXA_ACADEMIC_AUTHORITY,
    snapshotId,
    evidence,
    constraints,
  };
}

/** Mirrors NEXA v1.96's exact canonical SHA-256 context binding. */
export function fingerprintNexaAcademicContext(
  context: NexaBridgeAcademicContext
): string | null {
  const normalized = normalizeContext(context);
  if (!normalized) return null;
  const canonical = JSON.stringify({
    authority: normalized.authority,
    snapshotId: normalized.snapshotId,
    evidence: [...normalized.evidence],
    constraints: [...normalized.constraints],
  });
  return createHash("sha256")
    .update("nexa-academic-context-binding-v1\0", "utf8")
    .update(canonical, "utf8")
    .digest("hex");
}

function validConfiguration(
  config: NexaBridgeConfiguration
): { origin: string; secret: string; timeoutMs: number } | null {
  if (typeof config.secret !== "string" || config.secret.trim().length < 32)
    return null;
  let url: URL;
  try {
    url = new URL(config.baseUrl);
  } catch {
    return null;
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  )
    return null;
  const local =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (
    url.protocol !== "https:" &&
    !(config.allowLocalHttp === true && local && url.protocol === "http:")
  )
    return null;
  const timeoutMs = config.timeoutMs ?? 12_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 18_000)
    return null;
  return { origin: url.origin, secret: config.secret.trim(), timeoutMs };
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isInteger(length) || length < 0 || length > MAX_RESPONSE_BYTES)
      return null;
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) return null;
      chunks.push(item.value);
    }
    const body = Buffer.concat(chunks, bytes).toString("utf8");
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function validReply(
  value: unknown,
  response: Response,
  requestId: string,
  capability: NexaBridgeCapability,
  context: NormalizedContext | null,
  fingerprint: string | null
): value is {
  ok: true;
  content: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (
    payload.ok !== true ||
    payload.requestId !== requestId ||
    payload.capability !== capability ||
    typeof payload.content !== "string" ||
    !payload.content.trim() ||
    payload.content.length > MAX_ANSWER_CHARS
  )
    return false;
  if (
    response.headers.get("x-nexa-bridge-contract") !== NEXA_BRIDGE_VERSION ||
    response.headers.get("x-nexa-provider-contract") !==
      NEXA_PROVIDER_VERSION ||
    response.headers.get("x-nexa-bridge-request-id") !== requestId
  )
    return false;
  const metadata = payload.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return false;
  const record = metadata as Record<string, unknown>;
  if (
    record.contractVersion !== NEXA_PROVIDER_VERSION ||
    record.academicDecisionAuthority !== NEXA_ACADEMIC_AUTHORITY ||
    record.capability !== capability
  )
    return false;
  if (!context) {
    return (
      record.academicContext === null &&
      response.headers.get("x-nexa-academic-context-sha256") === null
    );
  }
  const binding = record.academicContext;
  if (!binding || typeof binding !== "object" || Array.isArray(binding))
    return false;
  const details = binding as Record<string, unknown>;
  return (
    details.bindingVersion === NEXA_BINDING_VERSION &&
    details.snapshotId === context.snapshotId &&
    details.fingerprint === fingerprint &&
    details.evidenceCount === context.evidence.length &&
    details.constraintCount === context.constraints.length &&
    response.headers.get("x-nexa-academic-context-sha256") === fingerprint
  );
}

/**
 * No academic mutation, account lookup, or direct browser access.
 * The caller must resolve and authorize subject + context from the same owner.
 */
export async function callNexaBridge(
  input: NexaBridgeCall
): Promise<NexaBridgeOutcome> {
  if (!input.configuration) return fail("disabled");
  const config = validConfiguration(input.configuration);
  if (!config) return fail("disabled");
  const userId = normalizeString(input.subject?.userId, 128);
  const prompt = normalizeString(input.prompt, 1_200);
  if (
    !userId ||
    !prompt ||
    !CAPABILITIES.includes(input.capability) ||
    input.signal?.aborted
  )
    return fail(input.signal?.aborted ? "cancelled" : "invalid_request");
  const context = normalizeContext(input.academicContext);
  if (context === false) return fail("invalid_request");
  const fingerprint = context ? fingerprintNexaAcademicContext(context) : null;
  if (context && !fingerprint) return fail("invalid_request");

  const requestId = randomUUID();
  const body = JSON.stringify({
    capability: input.capability,
    request: {
      requestId,
      userId,
      prompt,
      ...(context ? { academicContext: context } : {}),
    },
  });
  if (Buffer.byteLength(body, "utf8") > MAX_REQUEST_BYTES)
    return fail("invalid_request");

  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  input.signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
  try {
    const response = await (input.fetchImpl ?? fetch)(
      config.origin + "/api/integrations/student-os",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + config.secret,
          "x-student-os-user-id": userId,
          "X-NEXA-Bridge-Accept-Contract": NEXA_BRIDGE_VERSION,
        },
        body,
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 401 || response.status === 403)
        return fail("unauthorized");
      if (response.status === 409 || response.status === 428)
        return fail("incompatible");
      if (response.status === 429) return fail("rate_limited");
      return fail("unavailable");
    }
    if (response.status !== 200) return fail("malformed_response");
    const payload = await readBoundedJson(response);
    if (
      !validReply(
        payload,
        response,
        requestId,
        input.capability,
        context,
        fingerprint
      )
    )
      return fail("malformed_response");
    return {
      ok: true,
      answer: payload.content.trim(),
      requestId,
      capability: input.capability,
      advisoryOnly: true,
    };
  } catch {
    if (input.signal?.aborted) return fail("cancelled");
    return fail(timedOut ? "timeout" : "unavailable");
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", cancel);
  }
}
