import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getStudyRecommendationTopicId } from "./Study";

const source = readFileSync(
  fileURLToPath(new URL("./Study.tsx", import.meta.url)),
  "utf8"
);

describe("Study Planner ranked recommendation handoff", () => {
  it("reads only an opaque topic ID from a ranked-action URL", () => {
    expect(getStudyRecommendationTopicId("/study?topicId=waves")).toBe("waves");
    expect(
      getStudyRecommendationTopicId("/study?subject=Physics&topic=Waves")
    ).toBeNull();
    expect(getStudyRecommendationTopicId("/study?topicId=%20%20")).toBeNull();
  });

  it("resolves the incoming identity against canonical topics before pre-filling one new session", () => {
    expect(source).toContainSource(
      "const directTopic = state.topics.find((topic) => topic.id === recommendedTopicId);"
    );
    expect(source).toContainSource(
      "const examTopic = exam.topics.find((topic) => topic.id === recommendedTopicId);"
    );
    expect(source).toContainSource(
      "setDialogRecommendedTopic(incomingRecommendedTopic);"
    );
    expect(source).toContainSource("recommendedTopic={dialogRecommendedTopic}");
    expect(source).toContainSource(
      'setTopicId(recommendedTopic?.id ?? editing?.topicId ?? "");'
    );
    expect(source).toContainSource("recommendedTopic?.subject,");
    expect(source).toContainSource("subjectOptions.map((s) => (");
  });
});
