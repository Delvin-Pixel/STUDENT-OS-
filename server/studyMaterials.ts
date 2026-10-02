import { ENTITLEMENT_BASELINE_LIMITS } from "@shared/entitlements";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDb } from "./db";
import { logOperationalFailure } from "./safeOperationalLog";
import { storageGetSignedUrl, storagePut } from "./storage";
import { getWorkspace, validateWorkspacePayload } from "./workspace";

const MAX_MATERIAL_BYTES = 3_000_000;
const MAX_MATERIAL_FILES_PER_ACCOUNT =
  ENTITLEMENT_BASELINE_LIMITS.materialFilesPerAccount;
const MAX_MATERIAL_BYTES_PER_ACCOUNT =
  ENTITLEMENT_BASELINE_LIMITS.materialBytesPerAccount;
const supportedMimeTypes = ["application/pdf", "text/plain"] as const;

export const studyMaterialUploadSchema = z.object({
  title: z.string().trim().min(1).max(1_000),
  subject: z.string().trim().min(1).max(1_000),
  topicId: z.string().min(1).max(160).optional(),
  fileName: z.string().trim().min(1).max(1_000),
  dataUrl: z
    .string()
    .min(32)
    .max(4_100_000)
    .regex(
      /^data:(application\/pdf|text\/plain);base64,[A-Za-z0-9+/=]+$/,
      "Choose a PDF or plain-text study file."
    ),
});

function parseDataUrl(dataUrl: string) {
  const match =
    /^data:(application\/pdf|text\/plain);base64,([A-Za-z0-9+/=]+)$/.exec(
      dataUrl
    );
  if (!match)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a PDF or plain-text study file.",
    });
  const mimeType = match[1] as (typeof supportedMimeTypes)[number];
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_MATERIAL_BYTES)
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message:
        "Study materials must be 3 MB or smaller for this secure upload flow.",
    });
  return { mimeType, bytes };
}

function safeFileName(fileName: string, mimeType: string) {
  const base =
    fileName
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "study-material";
  const extension = mimeType === "application/pdf" ? ".pdf" : ".txt";
  return base.toLowerCase().endsWith(extension) ? base : `${base}${extension}`;
}

/** Keeps identical bytes deduplicated while giving distinct uploads collision-free object keys. */
export function materialStorageObjectName(
  contentHash: string,
  fileName: string,
  mimeType: string
) {
  return `${contentHash}-${safeFileName(fileName, mimeType)}`;
}

function rowsFromExecute(result: unknown) {
  const outer = Array.isArray(result) ? result[0] : result;
  return Array.isArray(outer) ? outer : [];
}

function affectedRows(result: unknown) {
  const candidate = Array.isArray(result) ? result[0] : result;
  if (!candidate || typeof candidate !== "object") return 0;
  const value =
    (candidate as { affectedRows?: unknown; rowsAffected?: unknown })
      .affectedRows ?? (candidate as { rowsAffected?: unknown }).rowsAffected;
  return typeof value === "number" ? value : 0;
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type StoredUpload = {
  storageKey: string;
  sizeBytes: number;
  mimeType: (typeof supportedMimeTypes)[number];
};

async function reserveMaterialUpload(
  openId: string,
  bytes: Buffer,
  mimeType: string
): Promise<{ db: Db; duplicate?: StoredUpload; hash?: string }> {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "Study material uploads are temporarily unavailable. Please try again shortly.",
    });
  const hash = createHash("sha256").update(bytes).digest("hex");
  const lookup = rowsFromExecute(
    await db.execute(
      sql`SELECT storageKey, sizeBytes, mimeType, status FROM material_uploads WHERE openId = ${openId} AND contentSha256 = ${hash} LIMIT 1`
    )
  );
  const existing = lookup[0] as
    | {
        storageKey?: unknown;
        sizeBytes?: unknown;
        mimeType?: unknown;
        status?: unknown;
      }
    | undefined;
  if (
    existing?.status === "stored" &&
    typeof existing.storageKey === "string" &&
    typeof existing.sizeBytes === "number" &&
    typeof existing.mimeType === "string" &&
    supportedMimeTypes.includes(
      existing.mimeType as (typeof supportedMimeTypes)[number]
    )
  )
    return {
      db,
      duplicate: {
        storageKey: existing.storageKey,
        sizeBytes: existing.sizeBytes,
        mimeType: existing.mimeType as (typeof supportedMimeTypes)[number],
      },
    };
  if (existing)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "A matching material upload is still being finalized. Please wait briefly and try again.",
    });
  await db.execute(
    sql`INSERT IGNORE INTO material_storage_usage (openId, fileCount, storedBytes) VALUES (${openId}, 0, 0)`
  );
  const quota = await db.execute(
    sql`UPDATE material_storage_usage SET fileCount = fileCount + 1, storedBytes = storedBytes + ${bytes.length} WHERE openId = ${openId} AND fileCount < ${MAX_MATERIAL_FILES_PER_ACCOUNT} AND storedBytes <= ${MAX_MATERIAL_BYTES_PER_ACCOUNT - bytes.length}`
  );
  if (affectedRows(quota) !== 1)
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message:
        "This account has reached its secure study-material storage limit. Remove or consolidate materials before uploading more.",
    });
  try {
    await db.execute(
      sql`INSERT INTO material_uploads (openId, contentSha256, sizeBytes, mimeType, status) VALUES (${openId}, ${hash}, ${bytes.length}, ${mimeType}, 'pending')`
    );
  } catch (error) {
    await db.execute(
      sql`UPDATE material_storage_usage SET fileCount = fileCount - 1, storedBytes = storedBytes - ${bytes.length} WHERE openId = ${openId}`
    );
    throw error;
  }
  return { db, hash };
}

async function releaseMaterialReservation(
  db: Db,
  openId: string,
  hash: string,
  sizeBytes: number
) {
  await db.execute(
    sql`DELETE FROM material_uploads WHERE openId = ${openId} AND contentSha256 = ${hash} AND status = 'pending'`
  );
  await db.execute(
    sql`UPDATE material_storage_usage SET fileCount = fileCount - 1, storedBytes = storedBytes - ${sizeBytes} WHERE openId = ${openId}`
  );
}

export async function uploadStudyMaterial(
  openId: string,
  input: z.infer<typeof studyMaterialUploadSchema>
) {
  const { mimeType, bytes } = parseDataUrl(input.dataUrl);
  const reservation = await reserveMaterialUpload(openId, bytes, mimeType);
  const fileName = safeFileName(input.fileName, mimeType);
  if (reservation.duplicate)
    return {
      key: reservation.duplicate.storageKey,
      url: await storageGetSignedUrl(reservation.duplicate.storageKey),
      mimeType: reservation.duplicate.mimeType,
      sizeBytes: reservation.duplicate.sizeBytes,
      fileName,
    };
  if (!reservation.hash)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Student OS could not prepare this material securely. Please try again.",
    });
  try {
    const uploaded = await storagePut(
      `${encodeURIComponent(openId)}/study-materials/${materialStorageObjectName(reservation.hash, input.fileName, mimeType)}`,
      bytes,
      mimeType
    );
    await reservation.db.execute(
      sql`UPDATE material_uploads SET storageKey = ${uploaded.key}, status = 'stored' WHERE openId = ${openId} AND contentSha256 = ${reservation.hash}`
    );
    return { ...uploaded, mimeType, sizeBytes: bytes.length, fileName };
  } catch (error) {
    if (reservation.hash)
      await releaseMaterialReservation(
        reservation.db,
        openId,
        reservation.hash,
        bytes.length
      ).catch(releaseError =>
        logOperationalFailure(
          "Study materials",
          "Upload reservation rollback failed",
          releaseError
        )
      );
    logOperationalFailure("Study materials", "Upload failed", error);
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message:
        "Student OS could not store this material. Your workspace has not changed; please try again.",
    });
  }
}

/** Resolves a temporary file URL only after proving the material belongs to the signed-in account workspace. */
export async function resolveOwnedStudyMaterialUrl(
  openId: string,
  storageKey: string
) {
  const record = await getWorkspace(openId);
  if (!record.workspace)
    throw new TRPCError({
      code: "NOT_FOUND",
      message:
        "This study material is not available in your account workspace.",
    });
  let workspace: unknown;
  try {
    workspace = JSON.parse(record.workspace);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The account workspace could not be read safely.",
    });
  }
  const validated = validateWorkspacePayload(workspace);
  if (!validated.ok)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The account workspace could not be validated safely.",
    });
  const materials = (
    JSON.parse(validated.text) as {
      studyMaterials: Array<{ storageKey: string }>;
    }
  ).studyMaterials;
  if (!materials.some(material => material.storageKey === storageKey))
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This material does not belong to the signed-in account.",
    });
  return { url: await storageGetSignedUrl(storageKey) };
}
