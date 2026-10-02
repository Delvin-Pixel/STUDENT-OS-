import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { logOperationalFailure } from "./safeOperationalLog";

const MATERIAL_RECONCILIATION_GRACE_MS = 10 * 60_000;

function rowsFromExecute(result: unknown) {
  const outer = Array.isArray(result) ? result[0] : result;
  return Array.isArray(outer) ? outer : [];
}

/**
 * Drops aged metadata keys that are no longer referenced by the newly persisted
 * canonical workspace. Storage does not expose a delete API; removing its last
 * metadata/UI key makes the private object unreachable through Student OS.
 */
export async function reconcileMaterialUploadMetadata(
  openId: string,
  workspaceText: string,
  now = new Date()
) {
  let storageKeys: Set<string>;
  try {
    const workspace = JSON.parse(workspaceText) as {
      studyMaterials?: Array<{ storageKey?: unknown }>;
    };
    storageKeys = new Set(
      (workspace.studyMaterials ?? []).flatMap(material =>
        typeof material.storageKey === "string" ? [material.storageKey] : []
      )
    );
  } catch {
    return;
  }
  const db = await getDb();
  if (!db || typeof (db as { execute?: unknown }).execute !== "function")
    return;
  try {
    const cutoff = new Date(now.getTime() - MATERIAL_RECONCILIATION_GRACE_MS);
    const rows = rowsFromExecute(
      await db.execute(
        sql`SELECT id, storageKey, sizeBytes, status FROM material_uploads WHERE openId = ${openId} AND createdAt <= ${cutoff}`
      )
    );
    for (const row of rows as Array<{
      id?: unknown;
      storageKey?: unknown;
      sizeBytes?: unknown;
      status?: unknown;
    }>) {
      if (typeof row.id !== "number" || typeof row.sizeBytes !== "number")
        continue;
      const stalePending = row.status === "pending";
      const unreferencedStored =
        row.status === "stored" &&
        typeof row.storageKey === "string" &&
        !storageKeys.has(row.storageKey);
      if (!stalePending && !unreferencedStored) continue;
      await db.execute(
        sql`DELETE FROM material_uploads WHERE id = ${row.id} AND openId = ${openId}`
      );
      await db.execute(
        sql`UPDATE material_storage_usage SET fileCount = GREATEST(fileCount - 1, 0), storedBytes = GREATEST(storedBytes - ${row.sizeBytes}, 0) WHERE openId = ${openId}`
      );
    }
  } catch (error) {
    logOperationalFailure(
      "Study materials",
      "Metadata reconciliation failed",
      error
    );
  }
}
