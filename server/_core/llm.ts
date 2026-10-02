import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?:
      | "audio/mpeg"
      | "audio/wav"
      | "application/pdf"
      | "audio/mp4"
      | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  maxCompletionTokens?: number;
  max_completion_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
  /** Cancels the upstream request and any pending retry delay. */
  signal?: AbortSignal;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () =>
  `${ENV.openAiApiBaseUrl.replace(/\/$/, "")}/v1/chat/completions`;

export function validatedAiApiKey(value: string) {
  const normalized = value.trim();
  if (!normalized)
    throw new Error("Student OS AI service configuration is unavailable.");
  return normalized;
}

const assertApiKey = () => validatedAiApiKey(ENV.openAiApiKey);

export class StudentOsAiError extends Error {
  readonly kind:
    | "configuration"
    | "timeout"
    | "upstream"
    | "malformed_response"
    | "rate_limited"
    | "cancelled";
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    kind: StudentOsAiError["kind"],
    message: string,
    options?: { status?: number; retryable?: boolean; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = "StudentOsAiError";
    this.kind = kind;
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
  }
}

export function safeLlmUpstreamError(
  operation: "invoke" | "models",
  status: number
) {
  if (status === 429) {
    return new StudentOsAiError(
      "rate_limited",
      `Student OS AI ${operation === "models" ? "model discovery" : "service"} is temporarily rate-limited. Please try again shortly.`,
      { status, retryable: true }
    );
  }
  return new StudentOsAiError(
    "upstream",
    `Student OS AI ${operation === "models" ? "model discovery" : "service"} is temporarily unavailable (HTTP ${status}).`,
    { status, retryable: status === 408 || status === 425 || status >= 500 }
  );
}

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const RETRY_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 350;
const RETRY_MAX_DELAY_MS = 5_000;
const LLM_UPSTREAM_TIMEOUT_MS = 15_000;
const MAX_LLM_RESPONSE_BYTES = 2_000_000;

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The LLM request was cancelled.", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(
          new DOMException("The LLM request was cancelled.", "AbortError")
        );
      },
      { once: true }
    );
  });

const isRetryableStatus = (status: number) =>
  status === 408 || status === 425 || status === 429 || status >= 500;

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

// Equal-jitter exponential backoff. The cap/2 floor guarantees a minimum
// delay so a misbehaving caller loop slows down instead of hammering the
// upstream while it keeps returning errors.
const computeBackoffDelay = (
  attempt: number,
  retryAfterMs?: number
): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

// Retries non-2xx responses and network errors with exponential backoff, then
// returns the final Response so callers keep their existing error handling.
const combineSignals = (
  signals: Array<AbortSignal | undefined>
): AbortSignal => {
  const available = signals.filter((signal): signal is AbortSignal =>
    Boolean(signal)
  );
  if (available.length === 1) return available[0];
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of available) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
};

const fetchWithBackoff = async (
  url: string,
  init: FetchInit
): Promise<Response> => {
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    LLM_UPSTREAM_TIMEOUT_MS
  );
  const signal = combineSignals([
    init.signal ?? undefined,
    timeoutController.signal,
  ]);
  const requestInit = { ...init, signal };
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, requestInit);
      if (
        response.ok ||
        attempt === RETRY_MAX_RETRIES ||
        !isRetryableStatus(response.status)
      ) {
        clearTimeout(timeout);
        return response;
      }

      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs), signal);
    } catch (error) {
      lastError = error;
      if (timeoutController.signal.aborted && !init.signal?.aborted) {
        clearTimeout(timeout);
        throw new StudentOsAiError(
          "timeout",
          "Student OS AI service timed out. Please try again shortly.",
          { retryable: true, cause: error }
        );
      }
      if (
        init.signal?.aborted ||
        (error instanceof DOMException && error.name === "AbortError") ||
        attempt === RETRY_MAX_RETRIES
      ) {
        throw error;
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt), signal);
    }
  }

  clearTimeout(timeout);
  throw lastError instanceof Error
    ? lastError
    : new StudentOsAiError(
        "upstream",
        "LLM request failed after exhausting retries",
        { retryable: true }
      );
};

const readJsonResponse = async <T>(
  response: Response,
  operation: "invoke" | "models"
): Promise<T> => {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    await response.body?.cancel().catch(() => undefined);
    throw new StudentOsAiError(
      "malformed_response",
      `Student OS AI ${operation === "models" ? "model discovery" : "service"} returned an unexpected response format.`,
      { retryable: true }
    );
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_LLM_RESPONSE_BYTES) {
    throw new StudentOsAiError(
      "malformed_response",
      `Student OS AI ${operation === "models" ? "model discovery" : "service"} returned an oversized response.`,
      { retryable: false }
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new StudentOsAiError(
      "malformed_response",
      `Student OS AI ${operation === "models" ? "model discovery" : "service"} returned invalid JSON.`,
      { retryable: true, cause: error }
    );
  }
};

const isValidInvokeResult = (value: unknown): value is InvokeResult => {
  if (!value || typeof value !== "object") return false;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return false;
  return choices.every(choice => {
    if (!choice || typeof choice !== "object") return false;
    const message = (choice as { message?: unknown }).message;
    return Boolean(
      message && typeof message === "object" && "content" in message
    );
  });
};

const isValidModelsResponse = (value: unknown): value is ModelsResponse => {
  if (!value || typeof value !== "object") return false;
  const data = (value as { data?: unknown }).data;
  return (
    Array.isArray(data) &&
    data.every(item => {
      if (!item || typeof item !== "object") return false;
      return typeof (item as { id?: unknown }).id === "string";
    })
  );
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    signal,
    maxTokens,
    max_tokens,
    maxCompletionTokens,
    max_completion_tokens,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
  };

  if (model) {
    payload.model = model;
  }

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }

  const resolvedMaxCompletionTokens =
    max_completion_tokens ?? maxCompletionTokens;
  if (typeof resolvedMaxCompletionTokens === "number") {
    payload.max_completion_tokens = resolvedMaxCompletionTokens;
  }

  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetchWithBackoff(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw safeLlmUpstreamError("invoke", response.status);
  }

  const result = await readJsonResponse<unknown>(response, "invoke");
  if (!isValidInvokeResult(result)) {
    throw new StudentOsAiError(
      "malformed_response",
      "Student OS AI service returned an incomplete response.",
      { retryable: true }
    );
  }
  return result;
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  /** Provider metadata is optional because older catalogs expose only IDs. */
  capabilities?: Record<string, unknown>;
};

/** Conservative gate for chat/text workflows; unknown legacy catalogs remain eligible. */
export function isTextGenerationModel(
  model: Pick<ModelInfo, "id" | "capabilities">
): boolean {
  const id = model.id.toLowerCase();
  if (/(embedding|moderation|whisper|tts|image|audio|video)/.test(id))
    return false;
  const capabilities = model.capabilities;
  if (!capabilities) return true;
  return capabilities.text !== false && capabilities.chat !== false;
}

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

export async function listLLMModels(): Promise<ModelsResponse> {
  const apiKey = assertApiKey();

  const url = `${ENV.openAiApiBaseUrl.replace(/\/$/, "")}/v1/models`;

  const response = await fetchWithBackoff(url, {
    headers: { authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw safeLlmUpstreamError("models", response.status);
  }

  const result = await readJsonResponse<unknown>(response, "models");
  if (!isValidModelsResponse(result)) {
    throw new StudentOsAiError(
      "malformed_response",
      "Student OS AI model discovery returned an invalid catalog.",
      { retryable: true }
    );
  }
  return result;
}
