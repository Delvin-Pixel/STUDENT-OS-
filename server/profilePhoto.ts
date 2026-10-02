import { TRPCError } from "@trpc/server";
import { storageGetSignedUrl, storagePut } from "./storage";

// The browser compresses source images before upload. Keep a generous transport
// ceiling for the compressed data URL to avoid rejecting ordinary phone photos,
// while still bounding request memory and storage abuse.
const MAX_PROFILE_PHOTO_BYTES = 8 * 1024 * 1024;
const MIME_DETAILS: Record<string, { extension: string; mime: string }> = {
  "image/jpeg": { extension: "jpg", mime: "image/jpeg" },
  "image/png": { extension: "png", mime: "image/png" },
  "image/webp": { extension: "webp", mime: "image/webp" },
};

function bytesBeginWith(bytes: Buffer, signature: number[]) {
  return (
    bytes.length >= signature.length &&
    signature.every((value, index) => bytes[index] === value)
  );
}

function hasMatchingImageSignature(bytes: Buffer, mime: string) {
  if (mime === "image/jpeg") return bytesBeginWith(bytes, [0xff, 0xd8, 0xff]);
  if (mime === "image/png")
    return bytesBeginWith(
      bytes,
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    );
  if (mime === "image/webp") {
    return (
      bytesBeginWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export function decodeProfilePhotoDataUrl(dataUrl: string): {
  bytes: Buffer;
  extension: string;
  mime: string;
} {
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Choose a valid PNG, JPEG, or WebP image.");

  const details = MIME_DETAILS[match[1]];
  if (!details) throw new Error("Choose a PNG, JPEG, or WebP image.");

  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error(
      "That optimized image is too large to upload. Please choose another image."
    );
  }
  if (!hasMatchingImageSignature(bytes, details.mime)) {
    throw new Error(
      "That file does not match the selected image type. Please choose a valid image."
    );
  }

  return { bytes, ...details };
}

export async function uploadProfilePhoto(openId: string, dataUrl: string) {
  const { bytes, extension, mime } = decodeProfilePhotoDataUrl(dataUrl);
  const fileName = `student-os/profile-photos/${encodeURIComponent(openId)}/${crypto.randomUUID()}.${extension}`;
  return storagePut(fileName, bytes, mime);
}

/** Resolves an avatar only when its server-derived key remains under the caller's account namespace. */
export async function resolveOwnedProfilePhotoUrl(
  openId: string,
  storageKey: string
) {
  const prefix = `student-os/profile-photos/${encodeURIComponent(openId)}/`;
  if (!storageKey.startsWith(prefix)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This profile photo does not belong to the signed-in account.",
    });
  }
  return { url: await storageGetSignedUrl(storageKey) };
}
