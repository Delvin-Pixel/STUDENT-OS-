import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storagePut: vi
    .fn()
    .mockResolvedValue({ key: "stored-key", url: "/storage/stored-key" }),
  storageGetSignedUrl: vi.fn(),
}));

import {
  decodeProfilePhotoDataUrl,
  resolveOwnedProfilePhotoUrl,
  uploadProfilePhoto,
} from "./profilePhoto";
import { storageGetSignedUrl, storagePut } from "./storage";

describe("profile-photo data URLs", () => {
  beforeEach(() => vi.clearAllMocks());
  it("decodes an allowed PNG data URL", () => {
    const result = decodeProfilePhotoDataUrl(
      "data:image/png;base64,iVBORw0KGgo="
    );
    expect(result.mime).toBe("image/png");
    expect(result.extension).toBe("png");
    expect([...result.bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("rejects unsafe or unsupported data URLs", () => {
    expect(() =>
      decodeProfilePhotoDataUrl("data:image/svg+xml;base64,PHN2Zy8+")
    ).toThrow("PNG, JPEG, or WebP");
    expect(() =>
      decodeProfilePhotoDataUrl("https://example.com/photo.png")
    ).toThrow("valid PNG");
  });

  it("rejects a data URL whose declared type does not match its bytes", () => {
    expect(() =>
      decodeProfilePhotoDataUrl("data:image/png;base64,aGVsbG8=")
    ).toThrow("does not match");
  });

  it("accepts an optimized avatar larger than the retired 2 MB limit", () => {
    const bytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(2 * 1024 * 1024),
    ]);
    const result = decodeProfilePhotoDataUrl(
      `data:image/png;base64,${bytes.toString("base64")}`
    );
    expect(result.bytes.length).toBe(bytes.length);
  });

  it("writes the photo beneath an account-scoped server-derived key", async () => {
    await uploadProfilePhoto(
      "openid/student A",
      "data:image/png;base64,iVBORw0KGgo="
    );
    expect(vi.mocked(storagePut).mock.calls[0][0]).toMatch(
      /^student-os\/profile-photos\/openid%2Fstudent%20A\//
    );
  });

  it("resolves only an avatar that is within the signed-in account namespace", async () => {
    vi.mocked(storageGetSignedUrl).mockResolvedValue(
      "https://signed.example/avatar.webp"
    );
    await expect(
      resolveOwnedProfilePhotoUrl(
        "alice",
        "student-os/profile-photos/alice/avatar.webp"
      )
    ).resolves.toEqual({ url: "https://signed.example/avatar.webp" });
    await expect(
      resolveOwnedProfilePhotoUrl(
        "bob",
        "student-os/profile-photos/alice/avatar.webp"
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storageGetSignedUrl).toHaveBeenCalledTimes(1);
  });
});
