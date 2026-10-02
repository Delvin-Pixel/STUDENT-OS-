import { describe, expect, it } from "vitest";
import { materialStorageObjectName } from "./studyMaterials";

describe("study material storage key integrity", () => {
  it("keeps same-name uploads with distinct bytes in distinct storage objects", () => {
    const first = materialStorageObjectName(
      "a".repeat(64),
      "Notes.pdf",
      "application/pdf"
    );
    const second = materialStorageObjectName(
      "b".repeat(64),
      "Notes.pdf",
      "application/pdf"
    );

    expect(first).toMatch(/^a{64}-Notes\.pdf$/);
    expect(second).toMatch(/^b{64}-Notes\.pdf$/);
    expect(first).not.toBe(second);
  });

  it("keeps a safe file extension after content addressing", () => {
    expect(
      materialStorageObjectName("c".repeat(64), "draft", "text/plain")
    ).toBe(`${"c".repeat(64)}-draft.txt`);
  });
});
