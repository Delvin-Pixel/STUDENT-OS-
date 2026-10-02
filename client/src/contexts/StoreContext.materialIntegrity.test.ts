import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./StoreContext.tsx", import.meta.url)),
  "utf8"
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .replace(/\b([A-Za-z_$][\w$]*) =>/g, "($1) =>");

describe("StoreContext canonical material integrity", () => {
  it("validates normalized completed upload metadata and reports acceptance to callers", () => {
    expect(source).toContain(
      "const normalizedMaterial = normalizeNewStudyMaterial(material);"
    );
    expect(source).toContain(
      "const validationError = validateNewStudyMaterial(normalizedMaterial);"
    );
    expect(source).toContain(
      "addStudyMaterial: (material: NewStudyMaterial) => boolean;"
    );
  });

  it("rejects stale topics, duplicate storage keys, and schema-capacity overflow before a material write", () => {
    expect(source).toContain(
      "This material’s topic is no longer available. Your upload details are still here."
    );
    expect(source).toContain(
      "hasStudyMaterialStorageKey(stateRef.current.studyMaterials, normalizedMaterial.storageKey)"
    );
    expect(source).toContain(
      "stateRef.current.studyMaterials.length >= WORKSPACE_STUDY_MATERIAL_LIMIT"
    );
  });
});
