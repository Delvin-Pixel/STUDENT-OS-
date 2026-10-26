import type { SyncTombstoneCollection } from "./types";

/**
 * B64 planning-only preflight for the existing revision-checked workspace sync.
 * No persistence, mutation, automatic conflict resolution, or new sync engine.
 *
 * Snapshots must be derived from validated, same-account workspace data; their
 * SHA-256 digests are comparison hints, NOT signatures or ownership proof.
 * In particular, a user-provided account ID cannot authenticate a request.
 */
export const OFFLINE_PREFLIGHT_VERSION = 1 as const;
const MAX_RECORDS = 20_000;
const MAX_CONFLICTS = 32;
const DIGEST = /^[0-9a-f]{64}$/;
const COLLECTIONS: readonly SyncTombstoneCollection[] = [
  "tasks",
  "sessions",
  "topics",
  "learningEvidence",
  "studyPlans",
  "studyPlanItems",
  "quizzes",
  "quizAttempts",
  "studyMaterials",
  "decks",
  "cards",
  "exams",
  "examTopics",
  "events",
  "transactions",
  "goals",
  "focusSessions",
  "notes",
  "achievements",
  "notifications",
  "customReminders",
  "aiAnswerRatings",
  "habits",
  "friends",
  "savedLessons",
] as const;

export type OfflineRecord =
  | Readonly<{
      collection: SyncTombstoneCollection;
      id: string;
      state: "present";
      digest: string;
    }>
  | Readonly<{
      collection: SyncTombstoneCollection;
      id: string;
      state: "deleted";
      digest?: never;
    }>;

export type OfflineSnapshot = Readonly<{
  accountId: string;
  revision: number;
  /** Digest of canonical scalar fields only, excluding item collections. */
  rootDigest: string;
  /** Complete record + durable tombstone inventory for this snapshot. */
  records: readonly OfflineRecord[];
}>;

export type OfflineConflict = Readonly<{
  collection: SyncTombstoneCollection | "workspaceScalars";
  id: string;
  kind: "same_record_edited" | "delete_versus_edit";
}>;

export type OfflinePreflightInput = Readonly<{
  /** Must be resolved from verified authentication at a later call site. */
  authenticatedAccountId: string;
  base: OfflineSnapshot;
  local: OfflineSnapshot;
  remote: OfflineSnapshot;
}>;

export type OfflinePreflightResult =
  | Readonly<{
      kind: "blocked";
      reason:
        | "invalid_snapshot"
        | "account_mismatch"
        | "invalid_revision"
        | "missing_deletion_marker"
        | "tombstone_resurrection"
        | "revision_content_mismatch";
    }>
  | Readonly<{
      kind:
        | "unchanged"
        | "adopt_remote"
        | "ready_for_revision_checked_write"
        | "rebase_required"
        | "manual_review";
      /** True means these are not safe to blindly merge or overwrite. */
      requiresHumanOrReviewedMerge: boolean;
      expectedRemoteRevision: number;
      localChanged: boolean;
      remoteChanged: boolean;
      conflicts: readonly OfflineConflict[];
      truncatedConflicts: boolean;
    }>;

type RecordState = Pick<OfflineRecord, "state"> & {
  digest?: string;
};
type Keyed = Readonly<{
  valid: true;
  records: Map<string, OfflineRecord>;
}>;

function recordKey(entry: Pick<OfflineRecord, "collection" | "id">): string {
  return JSON.stringify([entry.collection, entry.id]);
}

function indexSnapshot(snapshot: OfflineSnapshot): Keyed | null {
  if (
    !snapshot ||
    typeof snapshot.accountId !== "string" ||
    snapshot.accountId.length < 1 ||
    snapshot.accountId.length > 160 ||
    !Number.isSafeInteger(snapshot.revision) ||
    snapshot.revision < 0 ||
    !DIGEST.test(snapshot.rootDigest) ||
    !Array.isArray(snapshot.records) ||
    snapshot.records.length > MAX_RECORDS
  )
    return null;

  const records = new Map<string, OfflineRecord>();
  for (const entry of snapshot.records) {
    if (
      !entry ||
      !COLLECTIONS.includes(entry.collection) ||
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      entry.id.length > 160 ||
      (entry.state !== "present" && entry.state !== "deleted") ||
      (entry.state === "present" && !DIGEST.test(entry.digest)) ||
      (entry.state === "deleted" && "digest" in entry)
    )
      return null;
    const key = recordKey(entry);
    if (records.has(key)) return null;
    records.set(key, entry);
  }
  return { valid: true, records };
}

function same(a: RecordState | undefined, b: RecordState | undefined) {
  if (!a || !b) return !a && !b;
  return a.state === b.state && a.digest === b.digest;
}

function changed(
  base: Map<string, OfflineRecord>,
  other: Map<string, OfflineRecord>,
  baseRoot: string,
  otherRoot: string
): boolean {
  if (baseRoot !== otherRoot || base.size !== other.size) return true;
  for (const [key, entry] of base) {
    if (!same(entry, other.get(key))) return true;
  }
  return false;
}

/**
 * Three-way conflict detector. A changed remote revision is never an
 * authorization to call legacy local-wins merge: even disjoint edits require
 * a reviewed rebase that preserves remote-only modifications.
 */
export function preflightOfflineSync(
  input: OfflinePreflightInput
): OfflinePreflightResult {
  const base = indexSnapshot(input.base);
  const local = indexSnapshot(input.local);
  const remote = indexSnapshot(input.remote);
  if (!base || !local || !remote || !input.authenticatedAccountId?.trim())
    return { kind: "blocked", reason: "invalid_snapshot" };
  if (
    input.base.accountId !== input.authenticatedAccountId ||
    input.local.accountId !== input.authenticatedAccountId ||
    input.remote.accountId !== input.authenticatedAccountId
  )
    return { kind: "blocked", reason: "account_mismatch" };
  if (
    input.base.revision !== input.local.revision ||
    input.remote.revision < input.base.revision
  )
    return { kind: "blocked", reason: "invalid_revision" };

  const keys = new Set([
    ...base.records.keys(),
    ...local.records.keys(),
    ...remote.records.keys(),
  ]);
  if (keys.size > MAX_RECORDS)
    return { kind: "blocked", reason: "invalid_snapshot" };

  for (const key of keys) {
    const before = base.records.get(key);
    const onDevice = local.records.get(key);
    const onServer = remote.records.get(key);
    // A delete must leave a durable marker. Silent disappearance is unsafe
    // because an arbitrarily old device may later reintroduce that record.
    if (
      before &&
      ((!onDevice && before.state !== "deleted") ||
        (!onServer && before.state !== "deleted") ||
        (before.state === "deleted" && (!onDevice || !onServer)))
    )
      return { kind: "blocked", reason: "missing_deletion_marker" };
    if (
      before?.state === "deleted" &&
      (onDevice?.state === "present" || onServer?.state === "present")
    )
      return { kind: "blocked", reason: "tombstone_resurrection" };
  }

  const localChanged = changed(
    base.records,
    local.records,
    input.base.rootDigest,
    input.local.rootDigest
  );
  const remoteChanged = changed(
    base.records,
    remote.records,
    input.base.rootDigest,
    input.remote.rootDigest
  );

  if (
    input.remote.revision === input.base.revision &&
    remoteChanged
  )
    return { kind: "blocked", reason: "revision_content_mismatch" };

  const conflicts: OfflineConflict[] = [];
  let totalConflicts = 0;
  function recordConflict(conflict: OfflineConflict) {
    totalConflicts++;
    if (conflicts.length < MAX_CONFLICTS) conflicts.push(conflict);
  }

  if (
    input.base.rootDigest !== input.local.rootDigest &&
    input.base.rootDigest !== input.remote.rootDigest &&
    input.local.rootDigest !== input.remote.rootDigest
  )
    recordConflict({
      collection: "workspaceScalars",
      id: "singleton",
      kind: "same_record_edited",
    });

  for (const key of keys) {
    const before = base.records.get(key);
    const onDevice = local.records.get(key);
    const onServer = remote.records.get(key);
    if (
      !same(before, onDevice) &&
      !same(before, onServer) &&
      !same(onDevice, onServer)
    ) {
      const source = onDevice ?? onServer ?? before;
      if (!source) continue;
      recordConflict({
        collection: source.collection,
        id: source.id,
        kind:
          onDevice?.state === "deleted" || onServer?.state === "deleted"
            ? "delete_versus_edit"
            : "same_record_edited",
      });
    }
  }

  const kind =
    totalConflicts > 0
      ? "manual_review"
      : !localChanged && !remoteChanged
        ? "unchanged"
        : !localChanged
          ? "adopt_remote"
          : input.remote.revision === input.base.revision
            ? "ready_for_revision_checked_write"
            : "rebase_required";

  return {
    kind,
    requiresHumanOrReviewedMerge:
      kind === "manual_review" || kind === "rebase_required",
    expectedRemoteRevision: input.remote.revision,
    localChanged,
    remoteChanged,
    conflicts,
    truncatedConflicts: totalConflicts > MAX_CONFLICTS,
  };
}
