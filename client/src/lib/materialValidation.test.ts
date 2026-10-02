import { describe, expect, it } from "vitest";
import {
  normalizeNewStudyMaterial,
  validateNewStudyMaterial,
} from "./materialValidation";

const validMaterial = {
  title: "Chemistry revision",
  subject: "Chemistry",
  topicId: "topic-1",
  fileName: "revision.pdf",
  mimeType: "application/pdf" as const,
  storageKey: "materials/object-1",
  url: "",
  sizeBytes: 2_048,
};

describe("materialValidation", () => {
  it("normalizes and accepts a bounded completed private upload", () => {
    const normalized = normalizeNewStudyMaterial({
      ...validMaterial,
      title: " Chemistry revision ",
      storageKey: " materials/object-1 ",
    });
    expect(normalized.title).toBe("Chemistry revision");
    expect(normalized.storageKey).toBe("materials/object-1");
    expect(validateNewStudyMaterial(normalized)).toBeNull();
  });

  it("rejects empty, unsupported, impossible, and schema-exceeding material metadata", () => {
    expect(
      validateNewStudyMaterial({ ...validMaterial, title: " ".repeat(501) })
    ).toContain("Give the material");
    expect(
      validateNewStudyMaterial({
        ...validMaterial,
        mimeType: "image/png" as never,
      })
    ).toContain("PDF or plain-text");
    expect(
      validateNewStudyMaterial({ ...validMaterial, storageKey: "" })
    ).toContain("file reference");
    expect(
      validateNewStudyMaterial({ ...validMaterial, sizeBytes: 3_000_001 })
    ).toContain("3 MB");
  });
});
