import type { Profile } from "./types";

/** Resolve an opaque key only; the server still authorizes access for the account. */
export function profilePhotoStorageKey(
  profile:
    | Pick<Profile, "profilePhotoStorageKey" | "profilePhotoUrl">
    | null
    | undefined
): string | undefined {
  const key =
    profile?.profilePhotoStorageKey ??
    (profile?.profilePhotoUrl?.startsWith("/storage/")
      ? profile.profilePhotoUrl.slice("/storage/".length)
      : undefined);
  if (
    !key ||
    !/^student-os\/profile-photos\/[A-Za-z0-9_/-]+\.[A-Za-z0-9]+$/.test(key) ||
    key.includes("..") ||
    key.includes("//")
  )
    return undefined;
  return key;
}

export function toSafePrivateAssetPath(storageKey: string): string {
  const normalized = storageKey.trim().replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return `/storage/${normalized}`;
}
