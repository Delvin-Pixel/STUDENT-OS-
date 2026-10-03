import { createExpressMiddleware } from "@trpc/server/adapters/express";
import "dotenv/config";
import express from "express";
import { dispatchScheduledPush } from "../pushSchedule";
import { registerReleaseInfoRoute } from "../releaseInfo";
import { appRouter } from "../routers";
import { registerServiceWorkerRoute } from "../serviceWorkerRoute";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";

/** Shared HTTP routes for the standalone server and the Vercel function. */
export function createApp() {
  const app = express();
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
  return app;
}
