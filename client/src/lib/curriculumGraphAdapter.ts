import {
  CurriculumGraphSchema,
  getCurriculumPrerequisiteOrder,
  isCurriculumGraphCompatible,
  type CurriculumGraph,
} from "../../../shared/curriculumGraph";
import {
  AcademicContextSchema,
  type AcademicContext,
} from "../../../shared/academicContext";
import { getLearningPath, type LearningPath } from "./learningIntelligence";
import type { StudyState } from "./types";

export type CurriculumAwareLearningPath =
  | {
      ok: true;
      path: LearningPath;
      provenanceStatus: "unverified";
      /** Explicit graph identifiers used for this planning-only projection. */
      mappedGraphTopicIds: string[];
    }
  | {
      ok: false;
      reason:
        | "invalid_graph_or_context"
        | "context_mismatch"
        | "unknown_graph_topic"
        | "missing_topic_mapping"
        | "mapping_collision"
        | "missing_local_topic";
    };

/**
 * Opt-in planning bridge from a validated curriculum graph to existing
 * learner-local SubjectTopic identifiers. No automatic name matching, writes,
 * evidence changes, policy approval, or mastery decision takes place.
 *
 * Graph records are unverified source candidates. Calling this function must
 * not imply the curriculum is official.
 */
export function getCurriculumAwareLearningPath(
  state: StudyState,
  context: AcademicContext,
  graph: CurriculumGraph,
  graphTopicId: string,
  localTopicIds: Readonly<Record<string, string>>,
  today?: string
): CurriculumAwareLearningPath {
  const parsedGraph = CurriculumGraphSchema.safeParse(graph);
  if (!parsedGraph.success || !AcademicContextSchema.safeParse(context).success)
    return { ok: false, reason: "invalid_graph_or_context" };
  const validated = parsedGraph.data;
  if (!isCurriculumGraphCompatible(context, validated))
    return { ok: false, reason: "context_mismatch" };

  const prerequisites = getCurriculumPrerequisiteOrder(validated, graphTopicId);
  if (prerequisites === null)
    return { ok: false, reason: "unknown_graph_topic" };
  const closure = [...prerequisites, graphTopicId];
  const mapping = new Map<string, string>();
  const localIds = new Set<string>();
  const knownTopics = new Set(state.topics.map(topic => topic.id));

  for (const id of closure) {
    const localId = Object.prototype.hasOwnProperty.call(localTopicIds, id)
      ? localTopicIds[id]
      : undefined;
    if (typeof localId !== "string" || !localId)
      return { ok: false, reason: "missing_topic_mapping" };
    if (localIds.has(localId))
      return { ok: false, reason: "mapping_collision" };
    if (!knownTopics.has(localId))
      return { ok: false, reason: "missing_local_topic" };
    mapping.set(id, localId);
    localIds.add(localId);
  }

  const nodes = new Map(validated.nodes.map(node => [node.id, node]));
  const prerequisitesByLocalId = new Map<string, string[]>();
  for (const id of closure) {
    const localId = mapping.get(id)!;
    const links = (nodes.get(id)?.prerequisiteIds ?? []).map(prerequisiteId =>
      mapping.get(prerequisiteId)!
    );
    prerequisitesByLocalId.set(localId, links);
  }
  const projected: StudyState = {
    ...state,
    topics: state.topics.map(topic => {
      const links = prerequisitesByLocalId.get(topic.id);
      if (!links) return topic;
      return {
        ...topic,
        prerequisiteTopicIds: [
          ...new Set([...(topic.prerequisiteTopicIds ?? []), ...links]),
        ],
      };
    }),
  };
  const path = getLearningPath(projected, mapping.get(graphTopicId)!, today);
  // Explicit mapping already guaranteed the target exists in state.topics.
  if (!path) return { ok: false, reason: "missing_local_topic" };
  return {
    ok: true,
    path,
    provenanceStatus: "unverified",
    mappedGraphTopicIds: closure,
  };
}
