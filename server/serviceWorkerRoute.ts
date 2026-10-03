import type { Express, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";

export function activeServiceWorkerPath() {
  if (process.env.VERCEL === "1") {
    return path.resolve(process.cwd(), "dist", "public", "sw.js");
  }
  return process.env.NODE_ENV === "development"
    ? path.resolve(import.meta.dirname, "..", "client", "public", "sw.js")
    : path.resolve(import.meta.dirname, "public", "sw.js");
}

/**
 * Static hosting applies a long cache lifetime to public files. This endpoint
 * deliberately delivers the same worker outside that path, allowing every
 * generation check to revalidate and authorizing the worker to control `/`.
 */
export function registerServiceWorkerRoute(app: Express) {
  const serveWorker = (_req: Request, res: Response) => {
    const workerPath = activeServiceWorkerPath();
    if (!fs.existsSync(workerPath)) {
      res
        .status(503)
        .type("text/plain")
        .send("Student OS worker is unavailable.");
      return;
    }
    res.set({
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Surrogate-Control": "no-store",
      "Service-Worker-Allowed": "/",
      "Content-Type": "application/javascript; charset=utf-8",
    });
    res.sendFile(workerPath);
  };

  // The generation-specific endpoint prevents an already-installed worker or
  // intermediary cache from serving a retired authentication client forever.
  app.get("/api/service-worker.js", serveWorker);
  app.get("/api/service-worker-v15.js", serveWorker);
  app.get("/api/service-worker-v9.js", serveWorker);
  app.get("/api/service-worker-v10.js", serveWorker);
  app.get("/api/service-worker-v14.js", serveWorker);
  app.get("/api/service-worker-v13.js", serveWorker);
  app.get("/api/service-worker-v12.js", serveWorker);
  app.get("/api/service-worker-v11.js", serveWorker);
}
