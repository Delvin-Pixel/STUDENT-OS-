import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./routers.ts", import.meta.url)),
  "utf8"
);

describe("material AI router rate-limit integrity", () => {
  it("uses the shared account-scoped learner-draft allowance before both material provider surfaces", () => {
    const materialRouter = source.slice(
      source.indexOf("studyMaterials: router({"),
      source.indexOf("profilePhoto: router({")
    );
    expect(materialRouter).toMatch(
      /await enforceAiRateLimit\(ctx\.user\.openId, "learning_draft"\);[\s\S]*return generateMaterialSummary/
    );
    expect(materialRouter).toMatch(
      /await enforceAiRateLimit\(ctx\.user\.openId, "learning_draft"\);[\s\S]*return generateMaterialPracticeQuestions/
    );
  });
});
