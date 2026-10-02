import type { Express, Request, Response } from "express";
import { SERVICE_WORKER_VERSION } from "../client/src/lib/serviceWorkerVersion";

export type ReleaseInfo = {
  appVersion: string;
  serviceWorkerVersion: string;
  environment: "development" | "production" | "test";
  deploymentId: string | null;
  commitSha: string | null;
};

function nullableSafeValue(value: string | undefined, maxLength = 128) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function getReleaseInfo(): ReleaseInfo {
  const nodeEnvironment = process.env.NODE_ENV;
  return {
    appVersion: process.env.npm_package_version?.trim() || "1.0.0",
    serviceWorkerVersion: SERVICE_WORKER_VERSION,
    environment:
      nodeEnvironment === "production" || nodeEnvironment === "test"
        ? nodeEnvironment
        : "development",
    deploymentId: nullableSafeValue(
      process.env.VERCEL_DEPLOYMENT_ID ?? process.env.DEPLOYMENT_ID
    ),
    commitSha: nullableSafeValue(
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA,
      64
    ),
  };
}

export function registerReleaseInfoRoute(app: Express) {
  app.get("/api/release-info", (_req: Request, res: Response) => {
    res.set({
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Surrogate-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": "application/json; charset=utf-8",
    });
    res.json(getReleaseInfo());
  });
}
