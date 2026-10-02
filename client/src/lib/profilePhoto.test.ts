import { describe, expect, it } from "vitest";
import {
  PROFILE_PHOTO_MAX_DIMENSION,
  PROFILE_PHOTO_OUTPUT_MAX_BYTES,
  isSafeProfilePhotoOutput,
  profilePhotoDimensions,
  validateProfilePhotoFile,
} from "./profilePhoto";

describe("profile-picture validation", () => {
  it("accepts supported image sources regardless of source-file size", () => {
    expect(
      validateProfilePhotoFile({ type: "image/jpeg", size: 800_000 })
    ).toBeNull();
    expect(
      validateProfilePhotoFile({ type: "image/jpeg", size: 40 * 1024 * 1024 })
    ).toBeNull();
  });

  it("rejects unsupported image formats", () => {
    expect(
      validateProfilePhotoFile({ type: "image/svg+xml", size: 1_000 })
    ).toBe("Choose a PNG, JPEG, or WebP image.");
  });

  it("rejects empty images", () => {
    expect(validateProfilePhotoFile({ type: "image/png", size: 0 })).toContain(
      "empty"
    );
  });

  it("scales large images into the avatar dimension boundary without distortion", () => {
    expect(profilePhotoDimensions(4000, 3000)).toEqual({
      width: PROFILE_PHOTO_MAX_DIMENSION,
      height: 768,
    });
    expect(profilePhotoDimensions(600, 900)).toEqual({
      width: 600,
      height: 900,
    });
  });

  it("keeps only optimized avatar payloads within the safe server upload boundary", () => {
    expect(isSafeProfilePhotoOutput(PROFILE_PHOTO_OUTPUT_MAX_BYTES)).toBe(true);
    expect(isSafeProfilePhotoOutput(PROFILE_PHOTO_OUTPUT_MAX_BYTES + 1)).toBe(
      false
    );
    expect(isSafeProfilePhotoOutput(0)).toBe(false);
  });
});
