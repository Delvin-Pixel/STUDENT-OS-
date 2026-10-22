import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_PACK_LIMITS,
  parseKnowledgePackManifest,
  planKnowledgePackBatch,
} from "./academicKnowledgePack";
function fixture() {
  return {
    schemaVersion: 1,
    id: "physics-waves",
    version: "1.0.0",
    scope: {
      countryCode: "GH",
      educationSystem: "wassce",
      level: "shs",
      subject: "physics",
      curriculumVersion: "2026",
    },
    sources: [
      {
        id: "reference",
        title: "Test reference",
        publisher: "Test publisher",
        url: "https://example.org/curriculum",
        retrievedAt: "2026-10-21T12:00:00Z",
      },
    ],
    coverage: { topicIds: ["waves"] },
    chunks: [
      {
        id: "waves-1",
        bytes: 100_000,
        sha256: "a".repeat(64),
        topicIds: ["waves"],
        sourceIds: ["reference"],
      },
    ],
  };
}
describe("Academic Knowledge Pack preparation contract", () => {
  it("validates provenance structure without promoting it to official authority", () => {
    const result = parseKnowledgePackManifest(JSON.stringify(fixture()));
    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ provenanceStatus: "unverified" });
  });
  it.each([
    { schemaVersion: 2 },
    { version: "latest" },
    { verified: true },
    { coverage: { topicIds: ["waves", "missing"] } },
    { coverage: { topicIds: ["waves", "waves"] } },
  ])("rejects incompatible or inflated claims %j", change =>
    expect(
      parseKnowledgePackManifest(JSON.stringify({ ...fixture(), ...change })).ok
    ).toBe(false)
  );
  it("rejects unknown provenance and duplicate chunks", () => {
    const data = fixture();
    data.chunks[0].sourceIds = ["unlisted"];
    expect(parseKnowledgePackManifest(JSON.stringify(data)).ok).toBe(false);
    data.chunks[0].sourceIds = ["reference"];
    data.chunks.push(data.chunks[0]);
    expect(parseKnowledgePackManifest(JSON.stringify(data)).ok).toBe(false);
  });
  it.each([
    "http://example.org",
    "javascript:alert(1)",
    "https://user:example@example.org",
  ])("rejects unsafe source %s", url => {
    const data = fixture();
    data.sources[0].url = url;
    expect(parseKnowledgePackManifest(JSON.stringify(data)).ok).toBe(false);
  });
  it("rejects malformed JSON and oversized UTF-8 manifests", () => {
    expect(parseKnowledgePackManifest("{").ok).toBe(false);
    expect(parseKnowledgePackManifest("é".repeat(40_000))).toEqual({
      ok: false,
      reason: "manifest_too_large",
    });
  });
  it("bounds chunk and total pack bytes", () => {
    const data = fixture();
    data.chunks[0].bytes = KNOWLEDGE_PACK_LIMITS.chunkBytes + 1;
    expect(parseKnowledgePackManifest(JSON.stringify(data)).ok).toBe(false);
    data.chunks = Array.from({ length: 9 }, (_, i) => ({
      ...data.chunks[0],
      id: `chunk-${i}`,
      bytes: KNOWLEDGE_PACK_LIMITS.chunkBytes,
    }));
    expect(parseKnowledgePackManifest(JSON.stringify(data)).ok).toBe(false);
  });
  it("plans only exact curriculum scope and selected topics within Data Saver budget", () => {
    const data = fixture();
    data.chunks.push({ ...data.chunks[0], id: "waves-2" });
    const parsed = parseKnowledgePackManifest(JSON.stringify(data));
    if (!parsed.ok) throw new Error("Invalid test fixture");
    const before = JSON.stringify(parsed.manifest);
    expect(
      planKnowledgePackBatch(parsed.manifest, {
        scope: data.scope,
        topicIds: ["waves"],
        dataSaver: true,
      })
    ).toMatchObject({ bytes: 100_000, deferredChunkIds: ["waves-2"] });
    expect(
      planKnowledgePackBatch(parsed.manifest, {
        scope: { ...data.scope, curriculumVersion: "other" },
        topicIds: ["waves"],
        dataSaver: false,
      }).chunks
    ).toEqual([]);
    expect(
      planKnowledgePackBatch(parsed.manifest, {
        scope: data.scope,
        topicIds: [],
        dataSaver: false,
      }).chunks
    ).toEqual([]);
    expect(
      planKnowledgePackBatch(parsed.manifest, {
        scope: data.scope,
        topicIds: ["waves"],
        dataSaver: true,
        loadedChunkIds: ["waves-1"],
      }).chunks.map(chunk => chunk.id)
    ).toEqual(["waves-2"]);
    expect(JSON.stringify(parsed.manifest)).toBe(before);
  });
});
