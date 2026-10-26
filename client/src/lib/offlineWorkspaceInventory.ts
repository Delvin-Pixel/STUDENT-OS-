import {
  validateStudyState,
  validateStudyStateSemantics,
} from "@shared/workspaceSchema";
import {
  preflightOfflineSync,
  type OfflineSnapshot,
} from "./offlineSyncPreflight";
import { projectWorkspaceForCloud } from "./workspacePrivacy";
import type { StudyState, SyncTombstoneCollection } from "./types";

/**
 * B64.3: deterministic, schema-checked inventory of the *cloud-projected*
 * workspace. No DB writes, network I/O, or state changes.
 * SHA-256 provides change detection, NOT authentication or integrity signing.
 */
export const OFFLINE_INVENTORY_VERSION = 1 as const;
const MAX_WORKSPACE_BYTES = 4 * 1024 * 1024;
const MAX_RECORDS = 20_000;
const encoder = new TextEncoder();

const TOP_LEVEL_COLLECTIONS = [
  "tasks",
  "sessions",
  "topics",
  "learningEvidence",
  "studyPlans",
  "quizzes",
  "quizAttempts",
  "studyMaterials",
  "decks",
  "exams",
  "events",
  "transactions",
  "goals",
  "focusSessions",
  "notes",
  "achievements",
  "notifications",
  "customReminders",
  "habits",
  "friends",
  "savedLessons",
] as const satisfies readonly SyncTombstoneCollection[];

type InventoryResult =
  | Readonly<{ kind: "ready"; snapshot: OfflineSnapshot }>
  | Readonly<{
      kind: "invalid_workspace" | "invalid_account" | "unavailable";
    }>;

type RevisionedState = Readonly<{ workspace: unknown; revision: number }>;

export type CanonicalPreflightRequest = Readonly<{
  /** Caller MUST supply a verified, current authenticated owner resolver. */
  currentAuthenticatedAccountId: () => string | null;
  accountId: string;
  base: RevisionedState;
  local: RevisionedState;
  remote: RevisionedState;
}>;

export type CanonicalPreflightResult =
  | Readonly<{
      kind: "blocked";
      reason:
        | "account_mismatch"
        | "invalid_workspace"
        | "unavailable"
        | "invalid_snapshot";
    }>
  | Readonly<{
      kind: "evaluated";
      decision: ReturnType<typeof preflightOfflineSync>;
    }>;

function validAccount(accountId: unknown): accountId is string {
  return (
    typeof accountId === "string" &&
    accountId.length > 0 &&
    accountId.length <= 160 &&
    accountId.trim() === accountId
  );
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter(key => record[key] !== undefined)
        .map(key => [key, stable(record[key])])
    );
  }
  return value;
}

async function sha256(value: unknown): Promise<string> {
  const cryptography = globalThis.crypto?.subtle;
  if (!cryptography) throw new Error("offline_inventory_digest_unavailable");
  const digest = await cryptography.digest(
    "SHA-256",
    encoder.encode(JSON.stringify(stable(value)))
  );
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function cloudProjection(state: StudyState): StudyState {
  const projected = projectWorkspaceForCloud(state);
  return {
    ...projected,
    profile: projected.profile
      ? {
          ...projected.profile,
          ...(projected.profile.profilePhotoUrl !== undefined
            ? { profilePhotoUrl: "" }
            : {}),
        }
      : null,
    studyMaterials: projected.studyMaterials.map(material => ({
      ...material,
      url: "",
    })),
  };
}

function sortedSet(values: readonly string[]) {
  return [...new Set(values)].sort();
}

/**
 * Root covers every scalar/aggregate property not separately tracked by
 * item identity. Device-private ratings are never added to cloud snapshots.
 */
function rootFields(state: StudyState): Record<string, unknown> {
  const raw = state as unknown as Record<string, unknown>;
  const excluded = new Set<string>([
    ...TOP_LEVEL_COLLECTIONS,
    "syncTombstones",
    "aiAnswerRatings",
  ]);
  const root = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !excluded.has(key))
  );
  root.dailyLessonCompletions = sortedSet(state.dailyLessonCompletions);
  root.habitLog = Object.fromEntries(
    Object.entries(state.habitLog).map(([date, ids]) => [date, sortedSet(ids)])
  );
  return root;
}

/**
 * Nested collections use globally stable IDs. Include their parent in the
 * digest, so moving a card/item/topic to a different parent is a change.
 */
function withoutChild(
  item: object,
  child: "cards" | "items" | "topics"
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(item).filter(([key]) => key !== child)
  );
}

export async function buildOfflineWorkspaceInventory(
  accountId: string,
  workspace: unknown,
  revision: number
): Promise<InventoryResult> {
  if (!validAccount(accountId)) return { kind: "invalid_account" };
  if (!Number.isSafeInteger(revision) || revision < 0)
    return { kind: "invalid_workspace" };

  try {
    const parsed = validateStudyState(workspace);
    if (!parsed.success || !validateStudyStateSemantics(parsed.data).success)
      return { kind: "invalid_workspace" };

    const state = cloudProjection(parsed.data as StudyState);
    const serialized = JSON.stringify(state);
    if (encoder.encode(serialized).byteLength > MAX_WORKSPACE_BYTES)
      return { kind: "invalid_workspace" };

    const entries: Array<{
      collection: SyncTombstoneCollection;
      id: string;
      state: "present" | "deleted";
      digest?: string;
    }> = [];
    const seen = new Set<string>();
    const addPresent = async (
      collection: SyncTombstoneCollection,
      id: string,
      record: unknown
    ) => {
      const key = JSON.stringify([collection, id]);
      if (seen.has(key) || entries.length >= MAX_RECORDS)
        throw new Error("offline_inventory_duplicate_or_capacity");
      seen.add(key);
      entries.push({
        collection,
        id,
        state: "present",
        digest: await sha256([
          "studentos-offline-inventory-v1",
          accountId,
          collection,
          id,
          record,
        ]),
      });
    };

    for (const collection of TOP_LEVEL_COLLECTIONS) {
      const items = state[collection] as readonly { id: string }[];
      for (const item of items) {
        const data =
          collection === "decks"
            ? withoutChild(item, "cards")
            : collection === "studyPlans"
              ? withoutChild(item, "items")
              : collection === "exams"
                ? withoutChild(item, "topics")
                : item;
        await addPresent(collection, item.id, data);
      }
    }

    for (const deck of state.decks)
      for (const card of deck.cards)
        await addPresent("cards", card.id, { parentId: deck.id, item: card });
    for (const plan of state.studyPlans)
      for (const item of plan.items)
        await addPresent("studyPlanItems", item.id, {
          parentId: plan.id,
          item,
        });
    for (const exam of state.exams)
      for (const topic of exam.topics)
        await addPresent("examTopics", topic.id, {
          parentId: exam.id,
          item: topic,
        });

    // AI feedback is device-private by workspacePrivacy's established
    // contract and is deliberately omitted even if present on the device.
    for (const marker of state.syncTombstones) {
      if (marker.collection === "aiAnswerRatings") continue;
      const key = JSON.stringify([marker.collection, marker.id]);
      if (seen.has(key) || entries.length >= MAX_RECORDS)
        return { kind: "invalid_workspace" };
      seen.add(key);
      entries.push({
        collection: marker.collection,
        id: marker.id,
        state: "deleted",
      });
    }

    entries.sort((a, b) =>
      JSON.stringify([a.collection, a.id]).localeCompare(
        JSON.stringify([b.collection, b.id])
      )
    );
    const records: OfflineSnapshot["records"] = entries.map(entry =>
      entry.state === "deleted"
        ? {
            collection: entry.collection,
            id: entry.id,
            state: "deleted" as const,
          }
        : {
            collection: entry.collection,
            id: entry.id,
            state: "present" as const,
            digest: entry.digest!,
          }
    );
    return {
      kind: "ready",
      snapshot: {
        accountId,
        revision,
        rootDigest: await sha256([
          "studentos-offline-inventory-v1",
          accountId,
          "workspaceScalars",
          rootFields(state),
        ]),
        records,
      },
    };
  } catch {
    // Includes missing Web Crypto or unexpected validation/size failures.
    return { kind: "unavailable" };
  }
}

/**
 * Safe three-way adapter. This only constructs trusted-format fingerprints.
 * It does NOT establish that remote/base actually came from the authenticated
 * server; an owner-bound fetch and an acknowledged base are required at wiring.
 */
export async function preflightCanonicalOfflineWorkspaceSync(
  request: CanonicalPreflightRequest
): Promise<CanonicalPreflightResult> {
  const current = request.currentAuthenticatedAccountId;
  if (!validAccount(request.accountId) || current() !== request.accountId)
    return { kind: "blocked", reason: "account_mismatch" };

  const snapshots: OfflineSnapshot[] = [];
  for (const entry of [request.base, request.local, request.remote]) {
    if (current() !== request.accountId)
      return { kind: "blocked", reason: "account_mismatch" };
    const built = await buildOfflineWorkspaceInventory(
      request.accountId,
      entry.workspace,
      entry.revision
    );
    if (current() !== request.accountId)
      return { kind: "blocked", reason: "account_mismatch" };
    if (built.kind !== "ready")
      return {
        kind: "blocked",
        reason:
          built.kind === "invalid_workspace"
            ? "invalid_workspace"
            : "unavailable",
      };
    snapshots.push(built.snapshot);
  }

  const [base, local, remote] = snapshots;
  if (!base || !local || !remote)
    return { kind: "blocked", reason: "invalid_snapshot" };
  const decision = preflightOfflineSync({
    authenticatedAccountId: request.accountId,
    base,
    local,
    remote,
  });
  if (current() !== request.accountId)
    return { kind: "blocked", reason: "account_mismatch" };
  return { kind: "evaluated", decision };
}
