/**
 * Student OS storage abstraction.
 *
 * Objects are written directly with the AWS S3-compatible API and exposed to
 * clients only through short-lived signed URLs. No platform/vendor-specific
 * storage service is required.
 */
import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

const SIGNED_URL_TTL_SECONDS = 15 * 60;

function getStorageConfig() {
  if (!ENV.storageBucket) {
    throw new Error("Storage config missing: set STORAGE_BUCKET.");
  }
  if (!ENV.storageRegion) {
    throw new Error("Storage config missing: set STORAGE_REGION.");
  }
  return {
    bucket: ENV.storageBucket,
    region: ENV.storageRegion,
    endpoint: ENV.storageEndpoint || undefined,
  };
}

function createStorageClient() {
  const { region, endpoint } = getStorageConfig();
  return new S3Client({
    region,
    ...(endpoint
      ? { endpoint, forcePathStyle: ENV.storageForcePathStyle }
      : {}),
  });
}

function normalizeKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!key || key.includes("../") || key === ".." || key.includes("//")) {
    throw new Error("Invalid storage key.");
  }
  return key;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export function storageUrlPath(key: string): string {
  return `/storage/${key
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/")}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { bucket } = getStorageConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const client = createStorageClient();

  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  const url = await storageGetSignedUrl(key);
  return { key, url };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: await storageGetSignedUrl(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { bucket } = getStorageConfig();
  const key = normalizeKey(relKey);
  const client = createStorageClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: SIGNED_URL_TTL_SECONDS }
  );
}

/** Lightweight startup/readiness probe for deployments and health checks. */
export async function verifyStorageConfiguration() {
  const { bucket } = getStorageConfig();
  const client = createStorageClient();
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  return true;
}
