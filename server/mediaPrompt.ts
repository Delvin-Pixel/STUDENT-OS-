/**
 * Defensive parser for LLM-produced visual-generation prompts.
 *
 * In production, the LLM has returned prose containing unterminated strings
 * (e.g. an answer that includes a quoted sentence followed by trailing text),
 * so a naive JSON.parse call fails with
 * "Unterminated string in JSON" and media generation silently returns nothing.
 *
 * Parsing strategy, in order:
 *  1. Clean JSON parse (handles fenced ```json … ``` and bare objects).
 *  2. Extract the first top-level balanced `{…}` slice, tolerating prose after
 *     or instead of valid JSON structure around the object.
 *  3. Last resort: ask the LLM again demanding JSON-only output
 *     (`response_format: { type: "json_object" }` + strict system line).
 */
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { parseStructuredOutput } from "./aiStructuredOutput";

/** Defensive single-pass parse for a media-prompt JSON string. */
export function parseMediaPromptJson(raw: string): { prompt?: string } {
  const json = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(json) as { prompt?: string };
  } catch {
    const objectSlice = sliceBalancedObject(json);
    if (objectSlice) {
      try {
        return JSON.parse(objectSlice) as { prompt?: string };
      } catch {
        return {};
      }
    }
    return {};
  }
}

const mediaPromptSchema = z.object({
  prompt: z.string().trim().min(1).max(4_000),
});

export async function parseMediaPrompt(
  question: string,
  context: string,
  systemPreamble: string,
  signal?: AbortSignal
): Promise<string> {
  const result = await invokeLLM({
    maxTokens: 120,
    signal,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "media_prompt",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["prompt"],
          properties: {
            prompt: {
              type: "string",
              description:
                "A single detailed visual-generation prompt describing the image the learner asked for, including educational labels, style, and composition",
            },
          },
        },
      },
    },
    messages: [
      { role: "system", content: systemPreamble },
      {
        role: "user",
        content: `Study context: ${context || "None"}\n\nStudent request: ${question}`,
      },
    ],
  });

  const raw =
    typeof result.choices?.[0]?.message?.content === "string"
      ? result.choices[0].message.content
      : "";
  const json = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: { prompt?: string } = {};
  try {
    parsed = parseStructuredOutput(json, mediaPromptSchema, "Media prompt");
  } catch {
    const objectSlice = sliceBalancedObject(json);
    if (objectSlice) {
      try {
        parsed = parseStructuredOutput(
          objectSlice,
          mediaPromptSchema,
          "Media prompt"
        );
      } catch {
        parsed = {};
      }
    }
    if (!parsed.prompt) {
      const retry = await invokeLLM({
        maxTokens: 120,
        signal,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Output ONLY valid JSON with a single key "prompt". No other text, no explanation.',
          },
          { role: "user", content: `Student request: ${question}` },
        ],
      });
      const retryRaw =
        typeof retry.choices?.[0]?.message?.content === "string"
          ? retry.choices[0].message.content
          : "";
      parsed = parseStructuredOutput(
        retryRaw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim(),
        mediaPromptSchema,
        "Media prompt retry"
      );
    }
  }

  if (!parsed.prompt)
    throw new Error("Media request did not produce a visual prompt");
  return parsed.prompt;
}

/** Returns the first top-level balanced `{…}` slice of text, or null. */
export function sliceBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export const DEFAULT_MEDIA_SYSTEM_PROMPT =
  "You convert a student's request for an image, diagram, or visual media into one precise visual-generation prompt. Do not answer the underlying study question — only describe the image they want. Return plain, label-friendly visual descriptions suitable for an educational diagram. Never end the prompt with unmatched quotes.";
