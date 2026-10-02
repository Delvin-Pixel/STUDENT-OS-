import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StudyMaterials.tsx", import.meta.url)),
  "utf8"
);

describe("Study Material upload metadata integrity", () => {
  it("captures submission metadata and preserves the completed upload draft if canonical recording rejects", () => {
    expect(source).toContainSource(
      "const submittedMaterial = { title: title.trim(), subject: resolvedSubject"
    );
    expect(source).toContainSource(
      "upload.mutate({ ...submittedMaterial, fileName: file.name, dataUrl }, { onSuccess: (stored) => {"
    );
    expect(source).toContainSource(
      "const accepted = addStudyMaterial({ ...submittedMaterial, fileName: stored.fileName"
    );
    expect(source).toContainSource("if (!accepted) {");
    expect(source).toContainSource("Your upload details are still here.");
  });
});
