import { z } from "zod";

/** Preparation contract, not a content downloader or academic authority. */
export const KNOWLEDGE_PACK_LIMITS = {
  manifestBytes: 64 * 1024,
  chunkBytes: 1024 * 1024,
  packBytes: 8 * 1024 * 1024,
  dataSaverBatchBytes: 128 * 1024,
} as const;
const id = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/);
const ids = z.array(id).min(1).max(256);
const source = z
  .object({
    id,
    title: z.string().trim().min(1).max(200),
    publisher: z.string().trim().min(1).max(120),
    url: z
      .string()
      .max(2048)
      .url()
      .refine(value => {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      }, "Source must be an HTTPS reference without embedded credentials"),
    retrievedAt: z.iso.datetime(),
  })
  .strict();
const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    version: z
      .string()
      .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
      .max(32),
    scope: z
      .object({
        countryCode: z.string().regex(/^[A-Z]{2}$/),
        educationSystem: id,
        level: id,
        subject: id,
        curriculumVersion: z.string().min(1).max(64),
      })
      .strict(),
    sources: z.array(source).min(1).max(32),
    coverage: z
      .object({
        // Coverage is explicit and partial. It cannot claim a complete curriculum.
        topicIds: ids,
      })
      .strict(),
    chunks: z
      .array(
        z
          .object({
            id,
            bytes: z
              .number()
              .int()
              .positive()
              .max(KNOWLEDGE_PACK_LIMITS.chunkBytes),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            topicIds: ids,
            sourceIds: z.array(id).min(1).max(32),
          })
          .strict()
      )
      .min(1)
      .max(32),
  })
  .strict()
  .superRefine((manifest, context) => {
    const reject = (message: string) =>
      context.addIssue({ code: "custom", message });
    const unique = (values: string[]) => new Set(values).size === values.length;
    if (
      !unique(manifest.sources.map(s => s.id)) ||
      !unique(manifest.chunks.map(c => c.id)) ||
      !unique(manifest.coverage.topicIds)
    )
      reject("Duplicate identifiers");
    const sourceIds = new Set(manifest.sources.map(s => s.id));
    const declaredTopics = new Set(manifest.coverage.topicIds);
    const actualTopics = new Set<string>();
    let bytes = 0;
    for (const chunk of manifest.chunks) {
      bytes += chunk.bytes;
      if (!unique(chunk.topicIds) || !unique(chunk.sourceIds))
        reject("Duplicate chunk references");
      for (const sourceId of chunk.sourceIds)
        if (!sourceIds.has(sourceId)) reject("Unknown provenance source");
      for (const topic of chunk.topicIds) {
        if (!declaredTopics.has(topic)) reject("Undeclared topic coverage");
        actualTopics.add(topic);
      }
    }
    if (bytes > KNOWLEDGE_PACK_LIMITS.packBytes)
      reject("Pack exceeds byte budget");
    if (actualTopics.size !== declaredTopics.size)
      reject("Declared coverage has no content");
  });
export type AcademicKnowledgePackManifest = z.infer<typeof manifestSchema>;
export type KnowledgePackParseResult =
  | {
      ok: true;
      manifest: AcademicKnowledgePackManifest;
      provenanceStatus: "unverified";
    }
  | { ok: false; reason: "manifest_too_large" | "invalid_manifest" };

/** Parse bounded text only; references and digests do not attest official authority. */
export function parseKnowledgePackManifest(
  text: string
): KnowledgePackParseResult {
  if (
    text.length > KNOWLEDGE_PACK_LIMITS.manifestBytes ||
    new TextEncoder().encode(text).byteLength >
      KNOWLEDGE_PACK_LIMITS.manifestBytes
  )
    return { ok: false, reason: "manifest_too_large" };
  try {
    const parsed = manifestSchema.safeParse(JSON.parse(text));
    return parsed.success
      ? { ok: true, manifest: parsed.data, provenanceStatus: "unverified" }
      : { ok: false, reason: "invalid_manifest" };
  } catch {
    return { ok: false, reason: "invalid_manifest" };
  }
}

/** Plan a validated manifest only. Never fetches, caches, attests digests, or records mastery. */
export function planKnowledgePackBatch(
  manifest: AcademicKnowledgePackManifest,
  request: {
    scope: AcademicKnowledgePackManifest["scope"];
    topicIds: readonly string[];
    dataSaver: boolean;
    loadedChunkIds?: readonly string[];
  }
): {
  chunks: AcademicKnowledgePackManifest["chunks"];
  bytes: number;
  deferredChunkIds: string[];
} {
  const empty = { chunks: [], bytes: 0, deferredChunkIds: [] };
  if (
    Object.keys(manifest.scope).some(
      key =>
        manifest.scope[key as keyof typeof manifest.scope] !==
        request.scope[key as keyof typeof manifest.scope]
    )
  )
    return empty;
  const requested = new Set(request.topicIds.slice(0, 256));
  const loaded = new Set(request.loadedChunkIds?.slice(0, 32));
  const budget = request.dataSaver
    ? KNOWLEDGE_PACK_LIMITS.dataSaverBatchBytes
    : KNOWLEDGE_PACK_LIMITS.chunkBytes;
  const chunks: AcademicKnowledgePackManifest["chunks"] = [];
  const deferredChunkIds: string[] = [];
  let bytes = 0;
  for (const chunk of manifest.chunks) {
    if (
      loaded.has(chunk.id) ||
      !chunk.topicIds.some(topic => requested.has(topic))
    )
      continue;
    if (bytes + chunk.bytes > budget) {
      deferredChunkIds.push(chunk.id);
      continue;
    }
    chunks.push(chunk);
    bytes += chunk.bytes;
  }
  return { chunks, bytes, deferredChunkIds };
}
