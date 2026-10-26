import {
  validateStudyState,
  validateStudyStateSemantics,
  WORKSPACE_SCHEMA_VERSION,
} from "@shared/workspaceSchema";
import type { StudyState } from "./types";
import type {
  OfflineCacheBackend,
  OfflineStoredRecord,
} from "./offlineIndexedDbBackend";

export const OFFLINE_CACHE_VERSION = 1 as const;
export const OFFLINE_CACHE_MAX_BYTES = 4 * 1024 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const encoder = new TextEncoder();

export type OfflineCacheMetadata = Readonly<{
  revision: number;
  pending: boolean;
  savedAt: string;
}>;

export type OfflineCacheReadResult =
  | Readonly<{
      kind: "ready";
      state: StudyState;
      checksum: string;
      metadata: OfflineCacheMetadata;
    }>
  | Readonly<{
      kind: "missing" | "recovery_required" | "denied" | "unavailable";
    }>;

export type OfflineCacheWriteResult = Readonly<{
  kind: "saved" | "conflict" | "invalid" | "denied" | "unavailable";
  checksum?: string;
}>;

export type OfflineCacheMigrationResult = Readonly<{
  kind:
    | "migrated"
    | "already_present"
    | "legacy_missing"
    | "legacy_invalid"
    | "recovery_required"
    | "denied"
    | "unavailable"
    | "raced";
}>;

/**
 * The legacy source must read ONLY the existing exact account's localStorage
 * key. This is a read-only compatibility reader: no deletion or rewriting.
 */
export type LegacyOfflineSnapshot = Readonly<{
  json: string;
  revision: number;
  pending: boolean;
}>;

export type OfflineCacheAccess = Readonly<{
  /**
   * Must be backed by the already authenticated current account identity;
   * never infer an authenticated account from client-provided storage data.
   */
  currentAuthenticatedAccountId: () => string | null;
  backend: OfflineCacheBackend;
}>;

function accountAllowed(
  currentAuthenticatedAccountId: () => string | null,
  accountId: string
): boolean {
  return (
    typeof accountId === "string" &&
    accountId.length > 0 &&
    accountId.length <= 160 &&
    currentAuthenticatedAccountId() === accountId
  );
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

/**
 * Protect imported workspace state from stale temporary signed URLs while
 * retaining durable account-owned object storage references.
 */
function sanitizeStudyState(source: StudyState): StudyState {
  return {
    ...source,
    profile: source.profile
      ? {
          ...source.profile,
          ...(source.profile.profilePhotoUrl !== undefined
            ? { profilePhotoUrl: "" }
            : {}),
        }
      : null,
    studyMaterials: source.studyMaterials.map(material => ({
      ...material,
      url: "",
    })),
  };
}

function parseValidWorkspace(json: unknown): StudyState | null {
  if (
    typeof json !== "string" ||
    encoder.encode(json).byteLength > OFFLINE_CACHE_MAX_BYTES
  )
    return null;
  try {
    const parsed: unknown = JSON.parse(json);
    const shape = validateStudyState(parsed);
    if (!shape.success) return null;
    if (!validateStudyStateSemantics(shape.data).success) return null;
    return shape.data as StudyState;
  } catch {
    return null;
  }
}

async function sha256(record: Omit<OfflineStoredRecord, "sha256">) {
  const canonical = JSON.stringify([
    record.cacheVersion,
    record.workspaceSchemaVersion,
    record.accountId,
    record.revision,
    record.pending,
    record.savedAt,
    record.json,
  ]);
  const cryptoApi = globalThis.crypto?.subtle;
  if (!cryptoApi) throw new Error("offline_digest_unavailable");
  const digest = await cryptoApi.digest("SHA-256", encoder.encode(canonical));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function prepare(
  accountId: string,
  candidateState: StudyState,
  revision: number,
  pending: boolean,
  savedAt: string
): Promise<OfflineStoredRecord | null> {
  if (
    !isRevision(revision) ||
    typeof pending !== "boolean" ||
    typeof savedAt !== "string" ||
    !Number.isFinite(Date.parse(savedAt))
  )
    return null;
  const schema = validateStudyState(candidateState);
  if (!schema.success || !validateStudyStateSemantics(schema.data).success)
    return null;
  const sanitized = sanitizeStudyState(schema.data as StudyState);
  const json = JSON.stringify(sanitized);
  if (encoder.encode(json).byteLength > OFFLINE_CACHE_MAX_BYTES) return null;
  const withoutChecksum = {
    accountId,
    cacheVersion: OFFLINE_CACHE_VERSION,
    workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION,
    revision,
    pending,
    savedAt,
    json,
  } as const;
  return { ...withoutChecksum, sha256: await sha256(withoutChecksum) };
}

async function verify(
  record: unknown,
  accountId: string
): Promise<Extract<OfflineCacheReadResult, { kind: "ready" }> | null> {
  if (!record || typeof record !== "object" || Array.isArray(record))
    return null;
  const value = record as Partial<OfflineStoredRecord>;
  if (
    value.accountId !== accountId ||
    value.cacheVersion !== OFFLINE_CACHE_VERSION ||
    value.workspaceSchemaVersion !== WORKSPACE_SCHEMA_VERSION ||
    !isRevision(value.revision) ||
    typeof value.pending !== "boolean" ||
    typeof value.savedAt !== "string" ||
    !Number.isFinite(Date.parse(value.savedAt)) ||
    typeof value.json !== "string" ||
    typeof value.sha256 !== "string" ||
    !SHA256_PATTERN.test(value.sha256)
  )
    return null;

  const state = parseValidWorkspace(value.json);
  if (!state) return null;
  const actual = await sha256({
    accountId,
    cacheVersion: OFFLINE_CACHE_VERSION,
    workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION,
    revision: value.revision,
    pending: value.pending,
    savedAt: value.savedAt,
    json: value.json,
  });
  if (actual !== value.sha256) return null;
  return {
    kind: "ready",
    state: sanitizeStudyState(state),
    checksum: actual,
    metadata: {
      revision: value.revision,
      pending: value.pending,
      savedAt: value.savedAt,
    },
  };
}

/**
 * Unwired B64.2 local persistence adapter. Always creates a new record
 * snapshot and performs a single atomic CAS. The web app's existing
 * localStorage/cloud sync code remains authoritative until a later review.
 */
export function createOfflineIndexedDbCache(access: OfflineCacheAccess) {
  const permitted = (accountId: string) =>
    accountAllowed(access.currentAuthenticatedAccountId, accountId);

  async function read(accountId: string): Promise<OfflineCacheReadResult> {
    if (!permitted(accountId)) return { kind: "denied" };
    try {
      const raw = await access.backend.get(accountId);
      if (!permitted(accountId)) return { kind: "denied" };
      if (raw === undefined) return { kind: "missing" };
      const verified = await verify(raw, accountId);
      if (!permitted(accountId)) return { kind: "denied" };
      return verified ?? { kind: "recovery_required" };
    } catch {
      return { kind: "unavailable" };
    }
  }

  async function save(
    accountId: string,
    state: StudyState,
    revision: number,
    pending: boolean,
    expectedChecksum: string | null
  ): Promise<OfflineCacheWriteResult> {
    if (!permitted(accountId)) return { kind: "denied" };
    if (
      expectedChecksum !== null &&
      (typeof expectedChecksum !== "string" ||
        !SHA256_PATTERN.test(expectedChecksum))
    )
      return { kind: "invalid" };
    try {
      const envelope = await prepare(
        accountId,
        state,
        revision,
        pending,
        new Date().toISOString()
      );
      if (!envelope) return { kind: "invalid" };
      if (!permitted(accountId)) return { kind: "denied" };
      const wrote = await access.backend.compareAndSwap(
        accountId,
        expectedChecksum,
        envelope
      );
      if (!permitted(accountId)) return { kind: "denied" };
      return wrote
        ? { kind: "saved", checksum: envelope.sha256 }
        : { kind: "conflict" };
    } catch {
      return { kind: "unavailable" };
    }
  }

  async function migrateReadOnlyLegacy(
    accountId: string,
    readLegacy: (
      requestedAccountId: string
    ) => Promise<LegacyOfflineSnapshot | null>
  ): Promise<OfflineCacheMigrationResult> {
    if (!permitted(accountId)) return { kind: "denied" };
    const existing = await read(accountId);
    if (existing.kind === "denied") return { kind: "denied" };
    if (existing.kind === "unavailable") return { kind: "unavailable" };
    if (existing.kind === "recovery_required")
      return { kind: "recovery_required" };
    if (existing.kind === "ready") return { kind: "already_present" };
    try {
      const legacy = await readLegacy(accountId);
      if (!permitted(accountId)) return { kind: "denied" };
      if (!legacy) return { kind: "legacy_missing" };
      if (
        typeof legacy.json !== "string" ||
        !isRevision(legacy.revision) ||
        typeof legacy.pending !== "boolean"
      )
        return { kind: "legacy_invalid" };
      const state = parseValidWorkspace(legacy.json);
      if (!state) return { kind: "legacy_invalid" };
      const envelope = await prepare(
        accountId,
        state,
        legacy.revision,
        legacy.pending,
        new Date().toISOString()
      );
      if (!envelope) return { kind: "legacy_invalid" };
      if (!permitted(accountId)) return { kind: "denied" };
      const inserted = await access.backend.compareAndSwap(
        accountId,
        null,
        envelope
      );
      if (!permitted(accountId)) return { kind: "denied" };
      if (!inserted) {
        const afterRace = await read(accountId);
        if (afterRace.kind === "recovery_required")
          return { kind: "recovery_required" };
        return afterRace.kind === "ready"
          ? { kind: "raced" }
          : { kind: "unavailable" };
      }
      const afterWrite = await read(accountId);
      if (afterWrite.kind === "denied") return { kind: "denied" };
      if (
        afterWrite.kind !== "ready" ||
        afterWrite.checksum !== envelope.sha256
      )
        return { kind: "recovery_required" };
      return { kind: "migrated" };
    } catch {
      return { kind: "unavailable" };
    }
  }

  async function clearAccount(
    accountId: string
  ): Promise<"cleared" | "denied" | "unavailable"> {
    if (!permitted(accountId)) return "denied";
    try {
      await access.backend.remove(accountId);
      return permitted(accountId) ? "cleared" : "denied";
    } catch {
      return "unavailable";
    }
  }

  return { read, save, migrateReadOnlyLegacy, clearAccount } as const;
}
