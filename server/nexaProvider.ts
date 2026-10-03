import { randomUUID } from "node:crypto";
import { ENV } from "./_core/env";

export const NEXA_PROVIDER_DEFAULT_TIMEOUT_MS = 12_000;
export const NEXA_PROVIDER_MIN_TIMEOUT_MS = 1_000;
export const NEXA_PROVIDER_MAX_TIMEOUT_MS = 18_000;
export const NEXA_PROVIDER_MAX_RESPONSE_BYTES = 50_000;
export const NEXA_PROVIDER_MAX_ANSWER_CHARS = 8_000;

export type NexaProviderCapability =
  | "chat"
  | "explain"
  | "tutor"
  | "generateMaterial"
  | "generateQuiz"
  | "coach";

export type NexaAcademicContext = Readonly<{
  authority: "student-os-learning-intelligence";
  snapshotId?: string | null;
  evidence: readonly string[];
  constraints?: readonly string[];
}>;

export type NexaProviderConfig = Readonly<{
  baseUrl: string;
  secret: string;
  timeoutMs: number;
}>;

export type NexaProviderCallResult =
  | Readonly<{
      ok: true;
      answer: string;
      requestId: string;
      capability: NexaProviderCapability;
    }>
  | Readonly<{
      ok: false;
      reason:
        | "disabled"
        | "timeout"
        | "unavailable"
        | "provider_failure"
        | "malformed_response";
    }>;

type ConfigSource = Readonly<{
  url: string;
  secret: string;
  timeoutMs?: string | number;
  isProduction: boolean;
}>;

function localHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function normalizeNexaProviderConfig(source: ConfigSource): NexaProviderConfig | null {
  const rawUrl = source.url.trim();
  const secret = source.secret.trim();
  if (!rawUrl || secret.length < 32) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.username || url.password || url.search || url.hash) return null;
  if (source.isProduction && url.protocol !== "https:") return null;
  if (!source.isProduction && url.protocol === "http:" && !localHostname(url.hostname)) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const rawTimeout = source.timeoutMs ?? NEXA_PROVIDER_DEFAULT_TIMEOUT_MS;
  const timeoutMs = Number(rawTimeout);
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < NEXA_PROVIDER_MIN_TIMEOUT_MS ||
    timeoutMs > NEXA_PROVIDER_MAX_TIMEOUT_MS
  ) {
    return null;
  }

  return Object.freeze({
    baseUrl: url.origin,
    secret,
    timeoutMs,
  });
}

export function getNexaProviderConfig(): NexaProviderConfig | null {
  return normalizeNexaProviderConfig({
    url: ENV.nexaProviderUrl,
    secret: ENV.nexaProviderSecret,
    timeoutMs: ENV.nexaProviderTimeoutMs,
    isProduction: ENV.isProduction,
  });
}

export function selectNexaProviderCapability(question: string): NexaProviderCapability {
  const text = question.toLowerCase();
  if (/\b(?:quiz|test me|practice questions?|make questions?|generate questions?)\b/.test(text)) {
    return "generateQuiz";
  }
  if (/\b(?:study material|revision notes?|summary|cheat sheet|learning material)\b/.test(text)) {
    return "generateMaterial";
  }
  if (/\b(?:teach me|tutor me|walk me through|step[- ]by[- ]step|help me learn|solve with me)\b/.test(text)) {
    return "tutor";
  }
  if (/\b(?:explain|define|what is|what are|why does|why is|how does|how do)\b/.test(text)) {
    return "explain";
  }
  if (/\b(?:plan|schedule|focus|procrastinat|motivat|what should i study|what next|weakest|progress)\b/.test(text)) {
    return "coach";
  }
  return "chat";
}

type CallInput = Readonly<{
  userId: string;
  question: string;
  academicContext?: NexaAcademicContext;
  signal?: AbortSignal;
  config?: NexaProviderConfig | null;
  fetchImpl?: typeof fetch;
}>;

function isSuccessPayload(
  value: unknown,
  expectedRequestId: string,
  expectedCapability: NexaProviderCapability
): value is {
  ok: true;
  requestId: string;
  capability: NexaProviderCapability;
  content: string;
  metadata: {
    contractVersion: string;
    academicDecisionAuthority: string;
  };
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.ok !== true) return false;
  if (record.requestId !== expectedRequestId || record.capability !== expectedCapability) return false;
  if (typeof record.content !== "string" || !record.content.trim() || record.content.length > NEXA_PROVIDER_MAX_ANSWER_CHARS) {
    return false;
  }
  if (!record.metadata || typeof record.metadata !== "object") return false;
  const metadata = record.metadata as Record<string, unknown>;
  return (
    metadata.contractVersion === "1.0" &&
    metadata.academicDecisionAuthority === "student-os-learning-intelligence"
  );
}

function isFailurePayload(
  value: unknown,
  expectedRequestId: string,
  expectedCapability: NexaProviderCapability
) {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.ok === false &&
    record.requestId === expectedRequestId &&
    record.capability === expectedCapability &&
    typeof record.code === "string"
  );
}

export async function callNexaProvider(input: CallInput): Promise<NexaProviderCallResult> {
  const config = input.config === undefined ? getNexaProviderConfig() : input.config;
  if (!config) return { ok: false, reason: "disabled" };

  const userId = input.userId.trim();
  const question = input.question.trim();
  if (!userId || userId.length > 128 || !question || question.length > 1_200) {
    return { ok: false, reason: "malformed_response" };
  }

  const capability = selectNexaProviderCapability(question);
  const requestId = randomUUID();
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(input.signal?.reason);
  input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort("STUDENT_OS_NEXA_TIMEOUT");
  }, config.timeoutMs);

  try {
    const fetchImpl = input.fetchImpl ?? fetch;
    const response = await fetchImpl(
      `${config.baseUrl}/api/integrations/student-os`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.secret}`,
          "x-student-os-user-id": userId,
        },
        body: JSON.stringify({
          capability,
          request: {
            requestId,
            userId,
            prompt: question,
            ...(input.academicContext
              ? { academicContext: input.academicContext }
              : {}),
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, reason: "unavailable" };
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (
      Number.isFinite(contentLength) &&
      contentLength > NEXA_PROVIDER_MAX_RESPONSE_BYTES
    ) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, reason: "malformed_response" };
    }

    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > NEXA_PROVIDER_MAX_RESPONSE_BYTES) {
      return { ok: false, reason: "malformed_response" };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return { ok: false, reason: "malformed_response" };
    }

    if (isSuccessPayload(payload, requestId, capability)) {
      return {
        ok: true,
        answer: payload.content.trim(),
        requestId,
        capability,
      };
    }
    if (isFailurePayload(payload, requestId, capability)) {
      return { ok: false, reason: "provider_failure" };
    }
    return { ok: false, reason: "malformed_response" };
  } catch (error) {
    if (input.signal?.aborted) throw error;
    return { ok: false, reason: timedOut ? "timeout" : "unavailable" };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}
