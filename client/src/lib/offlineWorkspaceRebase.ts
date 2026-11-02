import {
  validateStudyState,
  validateStudyStateSemantics,
} from "@shared/workspaceSchema";
import {
  preflightCanonicalOfflineWorkspaceSync,
  type CanonicalPreflightRequest,
} from "./offlineWorkspaceInventory";
import { projectWorkspaceForCloud } from "./workspacePrivacy";
import type { StudyState, SyncTombstone } from "./types";

/**
 * B64.4 is a pure proposal builder. It never writes local or remote state.
 * The caller must still use the authenticated server revision-CAS contract.
 */
export type OfflineWorkspaceRebaseRequest = CanonicalPreflightRequest;

export type OfflineWorkspaceRebaseResult =
  | Readonly<{
      kind: "proposal";
      decision: "safe_rebase";
      expectedRemoteRevision: number;
      workspace: StudyState;
      changedPaths: readonly string[];
      writesPerformed: false;
      requiresRevisionCheckedWrite: true;
    }>
  | Readonly<{
      kind: "held";
      reason:
        | "account_mismatch"
        | "invalid_workspace"
        | "unavailable"
        | "invalid_snapshot"
        | "preflight_blocked"
        | "manual_review"
        | "not_rebase_required"
        | "merge_conflict"
        | "complexity_limit";
      preflightReason?: string;
      conflicts?: readonly unknown[];
    }>;

const MISSING = Symbol("offline-rebase-missing");
type Missing = typeof MISSING;
const MAX_MERGE_NODES = 50_000;
const MAX_DEPTH = 64;
const MAX_CHANGED_PATHS = 64;

class RebaseFailure extends Error {
  constructor(
    readonly reason: "merge_conflict" | "complexity_limit"
  ) {
    super(reason);
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (isPlainRecord(value)) {
    return "{" + Object.keys(value).sort()
      .filter(key => value[key] !== undefined)
      .map(key => JSON.stringify(key) + ":" + canonical(value[key]))
      .join(",") + "}";
  }
  return JSON.stringify(value);
}

function equal(a: unknown | Missing, b: unknown | Missing): boolean {
  if (a === MISSING || b === MISSING) return a === b;
  return canonical(a) === canonical(b);
}

function clone(value: unknown | Missing): unknown | Missing {
  if (value === MISSING) return MISSING;
  if (Array.isArray(value)) return value.map(entry => clone(entry));
  if (isPlainRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, clone(entry)])
    );
  }
  return value;
}

function keyedArray(value: unknown): value is Array<Record<string, unknown> & { id: string }> {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isPlainRecord(entry) || typeof entry.id !== "string" || !entry.id.trim()) {
      return false;
    }
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
  }
  return true;
}

function mergeTombstones(
  base: unknown | Missing,
  local: unknown | Missing,
  remote: unknown | Missing
): SyncTombstone[] {
  const values = [base, local, remote].filter(
    (value): value is unknown[] => Array.isArray(value)
  );
  if ([base, local, remote].some(value => value !== MISSING && !Array.isArray(value))) {
    throw new RebaseFailure("merge_conflict");
  }

  const byKey = new Map<string, SyncTombstone>();
  for (const list of values) {
    for (const value of list) {
      if (
        !isPlainRecord(value) ||
        typeof value.collection !== "string" ||
        typeof value.id !== "string" ||
        typeof value.deletedAt !== "string"
      ) {
        throw new RebaseFailure("merge_conflict");
      }
      const marker = value as unknown as SyncTombstone;
      const key = JSON.stringify([marker.collection, marker.id]);
      const previous = byKey.get(key);
      // A deletion marker is durable evidence. Never discard it because one
      // peer omitted it; choose a deterministic timestamp if both have one.
      if (!previous || marker.deletedAt < previous.deletedAt) byKey.set(key, marker);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    JSON.stringify([a.collection, a.id]).localeCompare(
      JSON.stringify([b.collection, b.id])
    )
  );
}

function mergeNode(
  base: unknown | Missing,
  local: unknown | Missing,
  remote: unknown | Missing,
  path: string,
  depth: number,
  budget: { nodes: number; changedPaths: string[] }
): unknown | Missing {
  budget.nodes++;
  if (budget.nodes > MAX_MERGE_NODES || depth > MAX_DEPTH) {
    throw new RebaseFailure("complexity_limit");
  }

  if (path === "syncTombstones") {
    return mergeTombstones(base, local, remote);
  }

  if (equal(local, base)) return clone(remote);
  if (equal(remote, base)) return clone(local);
  if (equal(local, remote)) return clone(local);

  if (path && budget.changedPaths.length < MAX_CHANGED_PATHS &&
      !budget.changedPaths.includes(path)) {
    budget.changedPaths.push(path);
  }

  if (
    (base === MISSING || isPlainRecord(base)) &&
    (local === MISSING || isPlainRecord(local)) &&
    (remote === MISSING || isPlainRecord(remote))
  ) {
    const before = base === MISSING ? {} : base;
    const onDevice = local === MISSING ? {} : local;
    const onServer = remote === MISSING ? {} : remote;
    const keys = new Set([
      ...Object.keys(before),
      ...Object.keys(onDevice),
      ...Object.keys(onServer),
    ]);
    const merged: Record<string, unknown> = {};
    for (const key of keys) {
      const next = mergeNode(
        Object.prototype.hasOwnProperty.call(before, key) ? before[key] : MISSING,
        Object.prototype.hasOwnProperty.call(onDevice, key) ? onDevice[key] : MISSING,
        Object.prototype.hasOwnProperty.call(onServer, key) ? onServer[key] : MISSING,
        path ? path + "." + key : key,
        depth + 1,
        budget
      );
      if (next !== MISSING) merged[key] = next;
    }
    return merged;
  }

  if (
    (base === MISSING || Array.isArray(base)) &&
    (local === MISSING || Array.isArray(local)) &&
    (remote === MISSING || Array.isArray(remote))
  ) {
    const arrays = [base, local, remote].filter(
      (value): value is unknown[] => Array.isArray(value)
    );
    if (arrays.every(keyedArray)) {
      type Identified = Array<Record<string, unknown> & { id: string }>;
      const before: Identified = base === MISSING ? [] : base as Identified;
      const onDevice: Identified = local === MISSING ? [] : local as Identified;
      const onServer: Identified = remote === MISSING ? [] : remote as Identified;
      const beforeMap = new Map(before.map(item => [item.id, item]));
      const localMap = new Map(onDevice.map(item => [item.id, item]));
      const remoteMap = new Map(onServer.map(item => [item.id, item]));
      // Server order is retained; local-only additions are appended in a
      // deterministic ID order. Ordering itself is not academic data.
      const order = [
        ...onServer.map(item => item.id),
        ...onDevice.map(item => item.id).filter(id => !remoteMap.has(id)).sort(),
        ...before.map(item => item.id).filter(
          id => !remoteMap.has(id) && !localMap.has(id)
        ),
      ];
      const merged: unknown[] = [];
      for (const id of [...new Set(order)]) {
        const next = mergeNode(
          beforeMap.has(id) ? beforeMap.get(id)! : MISSING,
          localMap.has(id) ? localMap.get(id)! : MISSING,
          remoteMap.has(id) ? remoteMap.get(id)! : MISSING,
          path + "[" + id + "]",
          depth + 1,
          budget
        );
        if (next !== MISSING) merged.push(next);
      }
      return merged;
    }
  }

  // Non-ID arrays and primitive values are not guessed or concatenated.
  throw new RebaseFailure("merge_conflict");
}

function cloudSafeWorkspace(state: StudyState): StudyState {
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

/**
 * Builds a deterministic candidate only when B64.1/B64.3 classify the three
 * snapshots as disjoint concurrent changes. Conflicting records, scalar
 * conflicts, tombstone ambiguity and invalid provenance remain held.
 */
export async function proposeOfflineWorkspaceRebase(
  request: OfflineWorkspaceRebaseRequest
): Promise<OfflineWorkspaceRebaseResult> {
  if (
    typeof request.currentAuthenticatedAccountId !== "function" ||
    request.currentAuthenticatedAccountId() !== request.accountId
  ) {
    return { kind: "held", reason: "account_mismatch" };
  }

  const preflight = await preflightCanonicalOfflineWorkspaceSync(request);
  if (request.currentAuthenticatedAccountId() !== request.accountId) {
    return { kind: "held", reason: "account_mismatch" };
  }
  if (preflight.kind === "blocked") {
    return {
      kind: "held",
      reason:
        preflight.reason === "account_mismatch"
          ? "account_mismatch"
          : preflight.reason === "invalid_workspace"
            ? "invalid_workspace"
            : preflight.reason === "unavailable"
              ? "unavailable"
              : "preflight_blocked",
      preflightReason: preflight.reason,
    };
  }

  if (preflight.decision.kind === "manual_review") {
    return {
      kind: "held",
      reason: "manual_review",
      conflicts: preflight.decision.conflicts,
    };
  }
  if (preflight.decision.kind !== "rebase_required") {
    return {
      kind: "held",
      reason: "not_rebase_required",
      preflightReason: preflight.decision.kind,
    };
  }

  try {
    const baseParsed = validateStudyState(request.base.workspace);
    const localParsed = validateStudyState(request.local.workspace);
    const remoteParsed = validateStudyState(request.remote.workspace);
    if (
      !baseParsed.success || !localParsed.success || !remoteParsed.success ||
      !validateStudyStateSemantics(baseParsed.data).success ||
      !validateStudyStateSemantics(localParsed.data).success ||
      !validateStudyStateSemantics(remoteParsed.data).success
    ) {
      return { kind: "held", reason: "invalid_workspace" };
    }

    const base = cloudSafeWorkspace(baseParsed.data as StudyState);
    const local = cloudSafeWorkspace(localParsed.data as StudyState);
    const remote = cloudSafeWorkspace(remoteParsed.data as StudyState);
    const budget = { nodes: 0, changedPaths: [] as string[] };
    const merged = mergeNode(
      base,
      local,
      remote,
      "",
      0,
      budget
    );
    if (!merged || merged === MISSING || !validateStudyState(merged).success) {
      return { kind: "held", reason: "merge_conflict" };
    }
    const parsed = validateStudyState(merged);
    if (!parsed.success || !validateStudyStateSemantics(parsed.data).success) {
      return { kind: "held", reason: "merge_conflict" };
    }
    if (request.currentAuthenticatedAccountId() !== request.accountId) {
      return { kind: "held", reason: "account_mismatch" };
    }

    return {
      kind: "proposal",
      decision: "safe_rebase",
      expectedRemoteRevision: preflight.decision.expectedRemoteRevision,
      workspace: parsed.data as StudyState,
      changedPaths: budget.changedPaths,
      writesPerformed: false,
      requiresRevisionCheckedWrite: true,
    };
  } catch (error) {
    if (error instanceof RebaseFailure) {
      return { kind: "held", reason: error.reason };
    }
    return { kind: "held", reason: "merge_conflict" };
  }
}
