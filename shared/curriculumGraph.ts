import { z } from "zod";
import {
  AcademicContextSchema,
  EducationLevelSchema,
  type AcademicContext,
} from "./academicContext";
import type { AcademicKnowledgePackManifest } from "./academicKnowledgePack";

/**
 * A bounded curriculum relationship candidate, never proof of official
 * curriculum authority. Only separately approved server policy may attest it.
 */
export const CURRICULUM_GRAPH_LIMITS = {
  manifestBytes: 128 * 1024,
  nodes: 256,
  sources: 32,
  prerequisitesPerNode: 32,
} as const;

const id = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/);
const reference = z
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
      }, "Use an HTTPS source reference without embedded credentials"),
    retrievedAt: z.iso.datetime(),
  })
  .strict();

export const CurriculumGraphSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    graphVersion: z
      .string()
      .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
    scope: z
      .object({
        countryCode: z.literal("GH"),
        educationLevel: EducationLevelSchema,
        educationSystem: id,
        subjectId: id,
        curriculumId: id,
        curriculumVersion: z.string().min(1).max(64),
        programId: id.optional(),
        institutionId: id.optional(),
      })
      .strict(),
    sources: z.array(reference).min(1).max(CURRICULUM_GRAPH_LIMITS.sources),
    nodes: z
      .array(
        z
          .object({
            id,
            title: z.string().trim().min(1).max(160),
            learningObjective: z.string().trim().min(1).max(1200),
            strandId: id.optional(),
            sourceIds: z.array(id).min(1).max(16),
            prerequisiteIds: z.array(id).max(CURRICULUM_GRAPH_LIMITS.prerequisitesPerNode),
          })
          .strict()
      )
      .min(1)
      .max(CURRICULUM_GRAPH_LIMITS.nodes),
  })
  .strict()
  .superRefine((graph, context) => {
    const reject = (message: string) =>
      context.addIssue({ code: "custom", message });
    const unique = (values: readonly string[]) =>
      new Set(values).size === values.length;

    if (graph.scope.educationLevel === "TERTIARY" && !graph.scope.programId)
      reject("Tertiary curriculum must name a program scope");
    if (!unique(graph.sources.map(source => source.id)))
      reject("Duplicate source identifiers");
    if (!unique(graph.nodes.map(node => node.id)))
      reject("Duplicate curriculum node identifiers");

    const sources = new Set(graph.sources.map(source => source.id));
    const nodes = new Map(graph.nodes.map(node => [node.id, node]));
    for (const node of graph.nodes) {
      if (!unique(node.sourceIds)) reject("Duplicate node source identifiers");
      if (!unique(node.prerequisiteIds))
        reject("Duplicate prerequisite identifiers");
      for (const sourceId of node.sourceIds) {
        if (!sources.has(sourceId)) reject("Unknown curriculum source");
      }
      for (const prerequisiteId of node.prerequisiteIds) {
        if (prerequisiteId === node.id)
          reject("A curriculum topic cannot depend on itself");
        if (!nodes.has(prerequisiteId))
          reject("Prerequisite is outside this curriculum graph");
      }
    }

    // The first detected cycle is sufficient to reject the entire manifest.
    const visiting = new Set<string>();
    const visited = new Set<string>();
    let hasCycle = false;
    const visit = (topicId: string) => {
      if (visiting.has(topicId)) {
        hasCycle = true;
        return;
      }
      if (visited.has(topicId) || hasCycle) return;
      visiting.add(topicId);
      for (const prerequisiteId of nodes.get(topicId)?.prerequisiteIds ?? [])
        if (nodes.has(prerequisiteId)) visit(prerequisiteId);
      visiting.delete(topicId);
      visited.add(topicId);
    };
    for (const node of graph.nodes) visit(node.id);
    if (hasCycle) reject("Curriculum prerequisite graph contains a cycle");
  });

export type CurriculumGraph = z.infer<typeof CurriculumGraphSchema>;

export type CurriculumGraphParseResult =
  | { ok: true; graph: CurriculumGraph; provenanceStatus: "unverified" }
  | { ok: false; reason: "manifest_too_large" | "invalid_graph" };

/** Parsing cannot establish academic authority or verified mastery. */
export function parseCurriculumGraphManifest(
  json: string
): CurriculumGraphParseResult {
  if (
    json.length > CURRICULUM_GRAPH_LIMITS.manifestBytes ||
    new TextEncoder().encode(json).byteLength >
      CURRICULUM_GRAPH_LIMITS.manifestBytes
  )
    return { ok: false, reason: "manifest_too_large" };
  try {
    const parsed = CurriculumGraphSchema.safeParse(JSON.parse(json));
    return parsed.success
      ? { ok: true, graph: parsed.data, provenanceStatus: "unverified" }
      : { ok: false, reason: "invalid_graph" };
  } catch {
    return { ok: false, reason: "invalid_graph" };
  }
}

/** Exact context compatibility for voluntary planning, not policy approval. */
export function isCurriculumGraphCompatible(
  context: AcademicContext,
  graph: CurriculumGraph
): boolean {
  if (!AcademicContextSchema.safeParse(context).success) return false;
  const scope = graph.scope;
  return (
    context.status === "active" &&
    context.countryCode === scope.countryCode &&
    context.educationLevel === scope.educationLevel &&
    context.curriculumId === scope.curriculumId &&
    context.curriculumVersion === scope.curriculumVersion &&
    (scope.programId === undefined || context.programId === scope.programId) &&
    (scope.institutionId === undefined ||
      context.institutionId === scope.institutionId)
  );
}

/** Stable prerequisite order; missing topics are never silently invented. */
export function getCurriculumPrerequisiteOrder(
  graph: CurriculumGraph,
  targetId: string
): string[] | null {
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  if (!nodes.has(targetId)) return null;
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (topicId: string) => {
    if (visited.has(topicId) || visiting.has(topicId)) return;
    visiting.add(topicId);
    for (const id of [...(nodes.get(topicId)?.prerequisiteIds ?? [])].sort()) {
      if (nodes.has(id)) visit(id);
    }
    visiting.delete(topicId);
    visited.add(topicId);
    if (topicId !== targetId) order.push(topicId);
  };
  visit(targetId);
  return order;
}

export type KnowledgePackGraphMatch =
  | { ok: false; reason: "scope_mismatch" | "unknown_topics" }
  | {
      ok: true;
      provenanceStatus: "unverified";
      curriculumIdentity: "not_attested_by_pack";
    };

/**
 * Match knowledge-pack coverage to graph topic IDs. The B59 pack schema does
 * not include a curriculumId, so a match is never an authority attestation.
 */
export function matchKnowledgePackToCurriculumGraph(
  graph: CurriculumGraph,
  pack: AcademicKnowledgePackManifest
): KnowledgePackGraphMatch {
  const scope = graph.scope;
  if (
    pack.scope.countryCode !== scope.countryCode ||
    pack.scope.educationSystem !== scope.educationSystem ||
    pack.scope.level !== scope.educationLevel.toLowerCase() ||
    pack.scope.subject !== scope.subjectId ||
    pack.scope.curriculumVersion !== scope.curriculumVersion
  )
    return { ok: false, reason: "scope_mismatch" };
  const known = new Set(graph.nodes.map(node => node.id));
  if (pack.coverage.topicIds.some(id => !known.has(id)))
    return { ok: false, reason: "unknown_topics" };
  return {
    ok: true,
    provenanceStatus: "unverified",
    curriculumIdentity: "not_attested_by_pack",
  };
}
