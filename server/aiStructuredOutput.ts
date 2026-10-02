export const MAX_STRUCTURED_OUTPUT_CHARS = 200_000;

/** Parse and validate model-produced JSON before it can become application state. */
export function parseStructuredOutput<T>(
  raw: unknown,
  schema: { parse(value: unknown): T },
  label: string,
  maxChars = MAX_STRUCTURED_OUTPUT_CHARS
): T {
  if (typeof raw !== "string") {
    throw new Error(`${label} returned no structured content.`);
  }
  const text = raw.trim();
  if (!text) throw new Error(`${label} returned an empty response.`);
  if (text.length > maxChars) {
    throw new Error(`${label} returned an oversized response.`);
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }

  return schema.parse(value);
}
