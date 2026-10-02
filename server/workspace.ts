/* STUDENT OS — per-user server workspace.
   Each signed-in account (openId) owns a JSON workspace blob on the server.
   New accounts receive an empty blob, which guarantees a fresh onboarding and
   never exposes one student's data to another. The browser keeps its local
   cache for offline feel; the server copy is the source of truth across devices. */

import { ENTITLEMENT_BASELINE_LIMITS } from "@shared/entitlements";
import {
  validateStudyState,
  validateStudyStateSemantics,
  WORKSPACE_SCHEMA_VERSION,
  type CanonicalStudyState,
} from "@shared/workspaceSchema";
import { and, eq, sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { reconcileMaterialUploadMetadata } from "./materialUploadMetadata";

export function sanitizeClientTransitionProvenance(
  state: CanonicalStudyState
): CanonicalStudyState {
  const hub = state.transitionDecisionHub;
  if (!hub) return state;

  return {
    ...state,
    transitionDecisionHub: {
      ...hub,
      aggregateConfidence:
        hub.aggregateConfidence === "calculated_local"
          ? "calculated_local"
          : hub.aggregateConfidence
            ? "unverified"
            : undefined,
      options: hub.options.map(option => ({
        ...option,
        confidence:
          option.confidence === "unverified" ? "unverified" : "learner_entered",
        sourceVerifiedAt: undefined,
      })),
    },
  };
}

export type WorkspaceRecord = {
  openId: string;
  workspace: string | null;
  revision: number;
  schemaVersion: number;
  updatedAt: Date | null;
};

export async function getWorkspace(openId: string): Promise<WorkspaceRecord> {
  const db = await getDb();
  if (!db)
    return {
      openId,
      workspace: null,
      revision: 0,
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      updatedAt: null,
    };
  const rows = await db
    .select({
      workspace: users.workspace,
      revision: users.workspaceRevision,
      schemaVersion: users.workspaceSchemaVersion,
      updatedAt: users.workspaceUpdatedAt,
    })
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  const row = rows[0];
  return {
    openId,
    workspace: row?.workspace ?? null,
    revision: row?.revision ?? 0,
    schemaVersion: row?.schemaVersion ?? WORKSPACE_SCHEMA_VERSION,
    updatedAt: row?.updatedAt ?? null,
  };
}

function affectedRows(result: unknown) {
  if (
    Array.isArray(result) &&
    typeof result[0] === "object" &&
    result[0] &&
    "affectedRows" in result[0]
  ) {
    return Number((result[0] as { affectedRows?: unknown }).affectedRows ?? 0);
  }
  if (typeof result === "object" && result && "affectedRows" in result)
    return Number((result as { affectedRows?: unknown }).affectedRows ?? 0);
  return 1;
}

export type WorkspaceWriteResult =
  | { ok: true; revision: number; updatedAt: Date }
  | {
      ok: false;
      reason: "conflict" | "unavailable";
      revision?: number;
      workspace?: string | null;
    };

export async function setWorkspace(
  openId: string,
  workspace: string,
  expectedRevision: number
): Promise<WorkspaceWriteResult> {
  const db = await getDb();
  if (!db) {
    console.warn("[Workspace] Cannot persist: database not available");
    return { ok: false, reason: "unavailable" };
  }
  const now = new Date();
  const result = await db
    .update(users)
    .set({
      workspace,
      workspaceSchemaVersion: WORKSPACE_SCHEMA_VERSION,
      workspaceRevision: sql`${users.workspaceRevision} + 1`,
      workspaceUpdatedAt: now,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(
      and(
        eq(users.openId, openId),
        eq(users.workspaceRevision, expectedRevision)
      )
    );
  if (affectedRows(result) > 0) {
    await reconcileMaterialUploadMetadata(openId, workspace);
    return { ok: true, revision: expectedRevision + 1, updatedAt: now };
  }
  const current = await getWorkspace(openId);
  return {
    ok: false,
    reason: "conflict",
    revision: current.revision,
    workspace: current.workspace,
  };
}

export async function clearWorkspace(
  openId: string
): Promise<WorkspaceWriteResult> {
  const current = await getWorkspace(openId);
  const db = await getDb();
  if (!db) return { ok: false, reason: "unavailable" };
  const now = new Date();
  const result = await db
    .update(users)
    .set({
      workspace: null,
      workspaceRevision: current.revision + 1,
      workspaceUpdatedAt: now,
    })
    .where(
      and(
        eq(users.openId, openId),
        eq(users.workspaceRevision, current.revision)
      )
    );
  if (affectedRows(result) > 0) {
    await reconcileMaterialUploadMetadata(
      openId,
      JSON.stringify({ studyMaterials: [] })
    );
    return { ok: true, revision: current.revision + 1, updatedAt: now };
  }
  const latest = await getWorkspace(openId);
  return {
    ok: false,
    reason: "conflict",
    revision: latest.revision,
    workspace: latest.workspace,
  };
}

/**
 * Application transport/backup cap. The live MySQL column is MEDIUMTEXT
 * (16 MiB maximum); this deliberately conservative 4 MiB UTF-8 payload cap
 * protects request latency, browser storage, exports, and conflict retries.
 */
export const MAX_WORKSPACE_BYTES = ENTITLEMENT_BASELINE_LIMITS.workspaceBytes;

export function validateWorkspacePayload(
  payload: unknown
): { ok: true; text: string } | { ok: false; reason: string } {
  let text: string;
  try {
    text = JSON.stringify(payload);
  } catch {
    return { ok: false, reason: "invalid JSON" };
  }
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > MAX_WORKSPACE_BYTES)
    return { ok: false, reason: `payload too large (${bytes} bytes)` };
  const parsed = validateStudyState(payload);
  if (!parsed.success)
    return {
      ok: false,
      reason: `workspace does not match the supported Student OS data format (${parsed.error.issues[0]?.path.join(".") || "unknown field"})`,
    };
  const semantic = validateStudyStateSemantics(parsed.data);
  if (!semantic.success)
    return {
      ok: false,
      reason: `workspace contains inconsistent academic data (${semantic.reason})`,
    };
  // Ratings are explicitly device-private learner feedback. A client must not
  // be able to turn the account workspace into a cloud history by bypassing
  // the normal sync projection.
  const sanitized = sanitizeClientTransitionProvenance(parsed.data);
  return {
    ok: true,
    text: JSON.stringify({ ...sanitized, aiAnswerRatings: [] }),
  };
}
