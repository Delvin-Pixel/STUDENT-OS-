import { describe, expect, it } from "vitest";
import { profilePhotoStorageKey } from "./privateAssets";

describe("profilePhotoStorageKey", () => {
  it("prefers the server-owned opaque storage key", () => {
    expect(
      profilePhotoStorageKey({
        profilePhotoStorageKey: "student-os/profile-photos/alice/photo.webp",
      })
    ).toBe("student-os/profile-photos/alice/photo.webp");
  });

  it("migrates only legacy raw storage paths and rejects arbitrary URLs", () => {
    expect(
      profilePhotoStorageKey({
        profilePhotoUrl: "/storage/student-os/profile-photos/alice/photo.webp",
      })
    ).toBe("student-os/profile-photos/alice/photo.webp");
    expect(
      profilePhotoStorageKey({
        profilePhotoUrl: "https://example.test/photo.webp",
      })
    ).toBeUndefined();
  });
});
