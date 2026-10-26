import { createExpressMiddleware } from "@trpc/server/adapters/express";
import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import { dispatchScheduledPush } from "../pushSchedule";
import { registerReleaseInfoRoute } from "../releaseInfo";
import { appRouter } from "../routers";
import { registerServiceWorkerRoute } from "../serviceWorkerRoute";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";

/** Shared HTTP routes for the standalone server and the Vercel function. */
export function createApp() {
  const app = express();
  // API responses may contain account data; never store them in shared caches.
  app.use("/api", (_req, res, next) => {
    res.set({
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    });
    next();
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  registerServiceWorkerRoute(app);
  registerReleaseInfoRoute(app);
  app.post("/api/scheduled/push-dispatch", dispatchScheduledPush);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  app.use("/api", (_req, res) => {
    res
      .status(404)
      .set("Cache-Control", "no-store")
      .json({ error: "Not found" });
  });
  // Parser failures happen before tRPC. Express's default handler emits HTML
  // and may include request content/stack details; keep the API boundary JSON.
  const apiErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const type = error && typeof error === "object" ? error.type : undefined;
    const status =
      type === "entity.too.large"
        ? 413
        : type === "encoding.unsupported" || type === "charset.unsupported"
          ? 415
          : type === "entity.parse.failed" || type === "request.size.invalid"
            ? 400
            : 500;
    res.status(status).json({
      error:
        status === 413
          ? "Request body too large"
          : status === 415
            ? "Unsupported request encoding"
            : status === 400
              ? "Invalid request body"
              : "Request failed",
    });
  };
  app.use("/api", apiErrorHandler);
  return app;
}
