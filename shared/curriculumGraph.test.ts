import { describe, expect, it } from "vitest";
import { AcademicContextSchema } from "./academicContext";
import { parseKnowledgePackManifest } from "./academicKnowledgePack";
import {
  CURRICULUM_GRAPH_LIMITS,
  getCurriculumPrerequisiteOrder,
  isCurriculumGraphCompatible,
  matchKnowledgePackToCurriculumGraph,
  parseCurriculumGraphManifest,
} from "./curriculumGraph";

function fixture(level: "JHS" | "SHS" | "TERTIARY" = "SHS") {
  return {
    schemaVersion: 1,
    id: "physics-prerequisites",
    graphVersion: "1.0.0",
    scope: {
      countryCode: "GH",
      educationLevel: level,
      educationSystem: "wassce",
      subjectId: "physics",
      curriculumId: "science-curriculum",
      curriculumVersion: "2026",
      ...(level === "TERTIARY" ? { programId: "bsc-it" } : {}),
    },
    sources: [
      {
        id: "source-1",
        title: "Example source, not an official curriculum",
        publisher: "Example publisher",
        url: "https://example.org/source",
        retrievedAt: "2026-10-24T12:00:00Z",
      },
    ],
    nodes: [
      {
        id: "motion",
        title: "Motion",
        learningObjective: "Explain speed and acceleration",
        sourceIds: ["source-1"],
        prerequisiteIds: ["algebra"],
      },
      {
        id: "numbers",
        title: "Numbers",
        learningObjective: "Calculate with numbers",
        sourceIds: ["source-1"],
        prerequisiteIds: [],
      },
      {
        id: "algebra",
        title: "Algebra",
        learningObjective: "Rearrange expressions",
        sourceIds: ["source-1"],
        prerequisiteIds: ["numbers"],
      },
    ],
  };
}

function parseFixture(level: "JHS" | "SHS" | "TERTIARY" = "SHS") {
  const result = parseCurriculumGraphManifest(JSON.stringify(fixture(level)));
  if (!result.ok) throw new Error("Broken test curriculum fixture");
  return result.graph;
}

function context(level: "JHS" | "SHS" | "TERTIARY" = "SHS") {
  return AcademicContextSchema.parse({
    id: "context-1",
    learnerId: "learner",
    countryCode: "GH",
    educationLevel: level,
    enrollmentMode: "private_candidate",
    curriculumId: "science-curriculum",
    curriculumVersion: "2026",
    policyBundleId: "review-required",
    status: "active",
    ...(level === "TERTIARY" ? { programId: "bsc-it" } : {}),
  });
}

function packFixture() {
  return {
    schemaVersion: 1,
    id: "physics-source",
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
        id: "example",
        title: "Example content reference",
        publisher: "Example",
        url: "https://example.org/content",
        retrievedAt: "2026-10-24T12:00:00Z",
      },
    ],
    coverage: { topicIds: ["motion", "numbers"] },
    chunks: [
      {
        id: "chunk-1",
        bytes: 1024,
        sha256: "a".repeat(64),
        topicIds: ["motion", "numbers"],
        sourceIds: ["example"],
      },
    ],
  };
}

describe("B62.2 bounded curriculum graph", () => {
  it.each(["JHS", "SHS", "TERTIARY"] as const)(
    "accepts scoped %s prerequisites without declaring academic authority",
    level => {
      const result = parseCurriculumGraphManifest(JSON.stringify(fixture(level)));
      expect(result).toMatchObject({
        ok: true,
        provenanceStatus: "unverified",
      });
      if (result.ok) expect(isCurriculumGraphCompatible(context(level), result.graph)).toBe(true);
    }
  );

  it("rejects an unscoped tertiary programme", () => {
    const draft = fixture("TERTIARY");
    const { programId: _ignored, ...scope } = draft.scope;
    expect(
      parseCurriculumGraphManifest(
        JSON.stringify({ ...draft, scope })
      ).ok
    ).toBe(false);
    void _ignored;
  });

  it("orders multi-hop prerequisites deterministically without modifying the graph", () => {
    const graph = parseFixture();
    const before = JSON.stringify(graph);
    expect(getCurriculumPrerequisiteOrder(graph, "motion")).toEqual([
      "numbers",
      "algebra",
    ]);
    expect(getCurriculumPrerequisiteOrder(graph, "missing")).toBeNull();
    expect(getCurriculumPrerequisiteOrder(graph, "numbers")).toEqual([]);
    expect(JSON.stringify(graph)).toBe(before);
  });

  it.each([
    { kind: "self link", link: ["motion"] },
    { kind: "unknown link", link: ["another-topic"] },
    { kind: "duplicate link", link: ["algebra", "algebra"] },
  ])("rejects $kind", ({ link }) => {
    const graph = fixture();
    graph.nodes[0].prerequisiteIds = link;
    expect(parseCurriculumGraphManifest(JSON.stringify(graph)).ok).toBe(false);
  });

  it("rejects multi-node prerequisite cycles", () => {
    const graph = fixture();
    graph.nodes[1].prerequisiteIds = ["motion"];
    expect(parseCurriculumGraphManifest(JSON.stringify(graph)).ok).toBe(false);
  });

  it("rejects duplicate topic and source IDs, missing provenance, or unsafe URLs", () => {
    const graph = fixture();
    graph.nodes.push({ ...graph.nodes[0] });
    expect(parseCurriculumGraphManifest(JSON.stringify(graph)).ok).toBe(false);
    graph.nodes.pop();

    graph.nodes[0].sourceIds = ["absent"];
    expect(parseCurriculumGraphManifest(JSON.stringify(graph)).ok).toBe(false);
    graph.nodes[0].sourceIds = ["source-1"];

    graph.sources[0].url = "https://username:secret@example.org/source";
    expect(parseCurriculumGraphManifest(JSON.stringify(graph)).ok).toBe(false);
    graph.sources[0].url = "https://example.org/source";

    graph.sources.push({ ...graph.sources[0] });
    expect(parseCurriculumGraphManifest(JSON.stringify(graph)).ok).toBe(false);
  });

  it("rejects privilege-like fields and malformed or oversized JSON", () => {
    const graph = fixture();
    expect(
      parseCurriculumGraphManifest(
        JSON.stringify({ ...graph, official: true })
      ).ok
    ).toBe(false);
    expect(parseCurriculumGraphManifest("{").ok).toBe(false);
    expect(
      parseCurriculumGraphManifest("é".repeat(70_000))
    ).toEqual({ ok: false, reason: "manifest_too_large" });
    expect(CURRICULUM_GRAPH_LIMITS.nodes).toBeLessThanOrEqual(256);
  });

  it("blocks incompatible levels, curriculum versions, programmes, and institution scope", () => {
    const graph = parseFixture();
    expect(isCurriculumGraphCompatible(context("JHS"), graph)).toBe(false);
    expect(
      isCurriculumGraphCompatible(
        { ...context(), curriculumVersion: "2027" },
        graph
      )
    ).toBe(false);
    expect(
      isCurriculumGraphCompatible(
        { ...context(), status: "historical" },
        graph
      )
    ).toBe(false);
    const tertiary = parseFixture("TERTIARY");
    expect(
      isCurriculumGraphCompatible(
        { ...context("TERTIARY"), programId: "other-course" },
        tertiary
      )
    ).toBe(false);
    expect(
      isCurriculumGraphCompatible(
        context("TERTIARY"),
        { ...tertiary, scope: { ...tertiary.scope, institutionId: "campus-a" } }
      )
    ).toBe(false);
  });

  it("links a knowledge-pack scope only as unverified coverage, never as official authority", () => {
    const pack = parseKnowledgePackManifest(JSON.stringify(packFixture()));
    if (!pack.ok) throw new Error("Broken test knowledge pack");
    const graph = parseFixture();
    expect(matchKnowledgePackToCurriculumGraph(graph, pack.manifest)).toEqual({
      ok: true,
      provenanceStatus: "unverified",
      curriculumIdentity: "not_attested_by_pack",
    });
    expect(
      matchKnowledgePackToCurriculumGraph(
        { ...graph, scope: { ...graph.scope, curriculumVersion: "2027" } },
        pack.manifest
      )
    ).toEqual({ ok: false, reason: "scope_mismatch" });
    expect(
      matchKnowledgePackToCurriculumGraph(graph, {
        ...pack.manifest,
        coverage: { topicIds: ["unknown"] },
      })
    ).toEqual({ ok: false, reason: "unknown_topics" });
  });
});
