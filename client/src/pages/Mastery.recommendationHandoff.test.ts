import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getQuizRecommendationTopicId } from "./Quizzes";

const masterySource = readFileSync(
  fileURLToPath(new URL("./Mastery.tsx", import.meta.url)),
  "utf8"
);
const quizSource = readFileSync(
  fileURLToPath(new URL("./Quizzes.tsx", import.meta.url)),
  "utf8"
);

describe("Mastery recommendation handoff", () => {
  it("carries the canonical topic ID into the chosen study or practice destination", () => {
    expect(masterySource).toContainSource(
      'getTopicRecommendationHref(weak[0].estimated ? "/quizzes" : "/study", weak[0].topicId)'
    );
    expect(masterySource).toContainSource(
      "getTopicRecommendationHref(action.route, item.topicId)"
    );
  });

  it("accepts only an opaque topic ID and resolves it through canonical topic options before pre-filling the quiz builder", () => {
    expect(getQuizRecommendationTopicId("/quizzes?topicId=waves")).toBe(
      "waves"
    );
    expect(
      getQuizRecommendationTopicId("/quizzes?subject=Physics&topic=Waves")
    ).toBeNull();
    expect(quizSource).toContainSource(
      "setBuilderRecommendedTopicId(recommendedTopicId);"
    );
    expect(quizSource).toContainSource(
      "...state.topics.map(topic => topic.id)"
    );
    expect(quizSource).toContainSource(
      "topicOptions.some(topic => topic.id === recommendedTopicId)"
    );
  });
});
