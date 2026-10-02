/**
 * Provider-neutral image generation helper using an OpenAI-compatible Images API
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 */
import { storagePut } from "../storage";
import { ENV } from "./env";

const DEFAULT_IMAGE_MODEL = "gpt-image-1";
const DEFAULT_IMAGE_QUALITY = "medium";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /** OpenAI image model, e.g. "gpt-image-1". */
  model?: string;
  /** Generation quality supported by the configured provider. */
  quality?: string;
  /** Cancels generation when the originating protected request disconnects. */
  signal?: AbortSignal;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured");

  const url = new URL(
    "v1/images/generations",
    `${ENV.openAiApiBaseUrl.replace(/\/$/, "")}/`
  );
  const model = options.model ?? DEFAULT_IMAGE_MODEL;
  const quality = options.quality ?? DEFAULT_IMAGE_QUALITY;

  // OpenAI's image-generation API accepts JSON for generation. Editing requires
  // multipart and is intentionally rejected here until an explicit edit flow is
  // introduced, preventing accidental data loss or URL-fetching SSRF.
  if (options.originalImages?.length) {
    throw new Error(
      "Image editing is not enabled in this provider-neutral image adapter yet."
    );
  }

  const response = await fetch(url, {
    method: "POST",
    signal: options.signal,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openAiApiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      quality,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const base64Data = result.data?.[0]?.b64_json;
  if (!base64Data)
    throw new Error("Image generation service returned no image data");
  const buffer = Buffer.from(base64Data, "base64");
  const { url: storedUrl } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png"
  );
  return { url: storedUrl };
}

export type ImageModelInfo = {
  /** Provider image model id, e.g. "gpt-image-2". */
  model?: string;
  /** Stable model id, e.g. "gpt-image-2". */
  id?: string;
};

export type ListImageModelsResponse = {
  models: ImageModelInfo[];
};

/**
 * List the image models the internal ImageService currently supports.
 * Feed a returned `model` value into generateImage({ model }).
 */
export async function listImageModels(): Promise<ListImageModelsResponse> {
  if (!ENV.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured");
  const url = `${ENV.openAiApiBaseUrl.replace(/\/$/, "")}/v1/models`;
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${ENV.openAiApiKey}` },
  });
  if (!response.ok)
    throw new Error(`Image model discovery failed (${response.status})`);
  const result = (await response.json()) as {
    data?: Array<{ id?: string; owned_by?: string }>;
  };
  return {
    models: (result.data ?? [])
      .filter(m => typeof m.id === "string" && /image/i.test(m.id))
      .map(m => ({ id: m.id, model: m.id })),
  };
}
