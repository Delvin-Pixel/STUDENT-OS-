import { describe, expect, it } from "vitest";
import { AcademicContextSchema } from "../../../shared/academicContext";
import {
  parseCurriculumGraphManifest,
  type CurriculumGraph,
} from "../../../shared/curriculumGraph";
import { getCurriculumAwareLearningPath } from "./curriculumGraphAdapter";
import { getLearningPath } from "./learningIntelligence";
import { emptyState } from "./storage";

const context = AcademicContextSchema.parse({
  id: "context-1",
  learnerId: "learner-a",
  countryCode: "GH",
  educationLevel: "SHS",
  enrollmentMode: "private_candidate",
  curriculumId: "science",
  curriculumVersion: "2026",
  policyBundleId: "policy-not-yet-authorized",
  status: "active",
});

function graph(): CurriculumGraph {
  const result = parseCurriculumGraphManifest(
    JSON.stringify({
      schemaVersion: 1,
      id: "physics-prerequisite-map",
      graphVersion: "1.0.0",
      scope: {
        countryCode: "GH",
        educationLevel: "SHS",
        educationSystem: "wassce",
        subjectId: "physics",
        curriculumId: "science",
        curriculumVersion: "2026",
      },
      sources: [
        {
          id: "reference",
          title: "Example source",
          publisher: "Example publisher",
          url: "https://example.org/physics",
          retrievedAt: "2026-10-24T12:00:00Z",
        },
      ],
      nodes: [
        {
          id: "motion",
          title: "Motion",
          learningObjective: "Describe motion",
          sourceIds: ["reference"],
          prerequisiteIds: ["algebra"],
        },
        {
          id: "algebra",
          title: "Algebra",
          learningObjective: "Rearrange equations",
          sourceIds: ["reference"],
          prerequisiteIds: ["numbers"],
        },
        {
          id: "numbers",
          title: "Numbers",
          learningObjective: "Calculate with numbers",
          sourceIds: ["reference"],
          prerequisiteIds: [],
        },
      ],
    })
  );
  if (!result.ok) throw new Error("Invalid graph fixture");
  return result.graph;
}

function workspace() {
  const state = emptyState();
  state.topics = [
    {
      id: "local-motion",
      subject: "Physics",
      name: "Speed and motion",
      source: "manual",
      createdAt: "2026-10-20",
      updatedAt: "2026-10-20",
    },
    {
      id: "local-algebra",
      subject: "Physics",
      name: "Equations",
      source: "manual",
      createdAt: "2026-10-20",
      updatedAt: "2026-10-20",
    },
    {
      id: "local-numbers",
      subject: "Physics",
      name: "Arithmetic",
      source: "manual",
      createdAt: "2026-10-20",
      updatedAt: "2026-10-20",
    },
  ];
  return state;
}

const mapping = {
  motion: "local-motion",
  algebra: "local-algebra",
  numbers: "local-numbers",
};

describe("B62.2 curriculum graph → deterministic learning path adapter", () => {
  it("uses exact explicit topic IDs and projects multi-hop prerequisites without writes", () => {
    const state = workspace();
    const before = JSON.stringify(state);
    const graphBefore = JSON.stringify(graph());
    const legacy = getLearningPath(state, "local-motion", "2026-10-24");
    expect(legacy?.steps.map(step => step.topicId)).toEqual(["local-motion"]);

    const projected = getCurriculumAwareLearningPath(
      state,
      context,
      graph(),
      "motion",
      mapping,
      "2026-10-24"
    );
    expect(projected).toMatchObject({
      ok: true,
      provenanceStatus: "unverified",
      mappedGraphTopicIds: ["numbers", "algebra", "motion"],
    });
    if (projected.ok) {
      expect(projected.path.steps.map(step => step.topicId)).toEqual([
        "local-numbers",
        "local-algebra",
        "local-motion",
      ]);
      expect(projected.path.status).toBe("needs_prerequisite");
    }
    expect(JSON.stringify(state)).toBe(before);
    expect(JSON.stringify(graph())).toBe(graphBefore);
    expect(state.learningEvidence).toEqual([]);
    expect(getLearningPath(state, "local-motion", "2026-10-24")).toEqual(
      legacy
    );
  });

  it("rejects mismatched curriculum versions and levels without guessing topics", () => {
    const state = workspace();
    expect(
      getCurriculumAwareLearningPath(
        state,
        { ...context, curriculumVersion: "2027" },
        graph(),
        "motion",
        mapping
      )
    ).toEqual({ ok: false, reason: "context_mismatch" });
    expect(
      getCurriculumAwareLearningPath(
        state,
        { ...context, educationLevel: "JHS" },
        graph(),
        "motion",
        mapping
      )
    ).toEqual({ ok: false, reason: "context_mismatch" });
    expect(
      getCurriculumAwareLearningPath(
        state,
        { ...context, status: "historical" },
        graph(),
        "motion",
        mapping
      )
    ).toEqual({ ok: false, reason: "context_mismatch" });
  });

  it("fails closed on incomplete, colliding, or nonexistent topic mappings", () => {
    const state = workspace();
    const g = graph();
    expect(
      getCurriculumAwareLearningPath(state, context, g, "missing", mapping)
    ).toEqual({ ok: false, reason: "unknown_graph_topic" });
    expect(
      getCurriculumAwareLearningPath(state, context, g, "motion", {
        motion: "local-motion",
        algebra: "local-algebra",
      })
    ).toEqual({ ok: false, reason: "missing_topic_mapping" });
    expect(
      getCurriculumAwareLearningPath(state, context, g, "motion", {
        ...mapping,
        numbers: "local-algebra",
      })
    ).toEqual({ ok: false, reason: "mapping_collision" });
    expect(
      getCurriculumAwareLearningPath(state, context, g, "motion", {
        ...mapping,
        numbers: "does-not-exist",
      })
    ).toEqual({ ok: false, reason: "missing_local_topic" });
  });

  it("rejects malformed graph input rather than treating it as authorized curriculum", () => {
    const state = workspace();
    expect(
      getCurriculumAwareLearningPath(
        state,
        context,
        { ...graph(), official: true } as CurriculumGraph,
        "motion",
        mapping
      )
    ).toEqual({ ok: false, reason: "invalid_graph_or_context" });
    expect(state.topics.every(topic => !topic.prerequisiteTopicIds)).toBe(true);
  });

  it("keeps the projection read-only even when a target already has local prerequisites", () => {
    const state = workspace();
    state.topics[0].prerequisiteTopicIds = ["local-numbers"];
    const before = JSON.stringify(state);
    const result = getCurriculumAwareLearningPath(
      state,
      context,
      graph(),
      "motion",
      mapping,
      "2026-10-24"
    );
    expect(result.ok).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
});
