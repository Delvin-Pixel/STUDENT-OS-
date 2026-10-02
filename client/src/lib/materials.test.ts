import { describe, expect, it } from "vitest";
import {
  hasStudyMaterialStorageKey,
  removeStudyMaterialById,
} from "./materials";
import type { StudyMaterial } from "./types";

const material: StudyMaterial = {
  id: "material-1",
  title: "Waves",
  subject: "Physics",
  fileName: "waves.pdf",
  mimeType: "application/pdf",
  storageKey: "account/study-materials/waves.pdf",
  url: "",
  sizeBytes: 12,
  addedAt: "2026-08-23T00:00:00.000Z",
};

describe("canonical material object deduplication", () => {
  it("recognizes an existing private object key while allowing a separate revision key", () => {
    expect(hasStudyMaterialStorageKey([material], material.storageKey)).toBe(
      true
    );
    expect(
      hasStudyMaterialStorageKey(
        [material],
        "account/study-materials/waves-revision.pdf"
      )
    ).toBe(false);
  });

  it("removes the material record and its private storage key from canonical learner state", () => {
    expect(removeStudyMaterialById([material], material.id)).toEqual([]);
  });
});
