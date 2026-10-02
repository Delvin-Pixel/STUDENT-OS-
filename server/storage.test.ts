import { describe, expect, it } from "vitest";
import { storageUrlPath } from "./storage";

describe("Student OS storage paths", () => {
  it("encodes each object-key path segment without exposing a vendor route", () => {
    expect(
      storageUrlPath("student-os/profile-photos/alice/avatar one.webp")
    ).toBe("/storage/student-os/profile-photos/alice/avatar%20one.webp");
    expect(storageUrlPath("alice/study-materials/chapter.pdf")).toBe(
      "/storage/alice/study-materials/chapter.pdf"
    );
  });

  it("never emits the retired vendor storage path", () => {
    expect(storageUrlPath("generated/diagram.png")).not.toContain(
      "legacy-private-storage"
    );
  });
});
