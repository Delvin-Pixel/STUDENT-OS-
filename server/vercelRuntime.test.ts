import { createServer, type Server } from "node:http";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../api/index";

let server: Server;
let origin: string;
let fixture: string;

beforeAll(async () => {
  fixture = mkdtempSync(path.join(tmpdir(), "student-os-vercel-"));
  mkdirSync(path.join(fixture, "dist/public"), { recursive: true });
  writeFileSync(
    path.join(fixture, "dist/public/sw.js"),
    readFileSync("client/public/sw.js")
  );
  vi.stubEnv("VERCEL", "1");
  vi.spyOn(process, "cwd").mockReturnValue(fixture);
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    );
  }
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(fixture, { recursive: true, force: true });
});

describe("Vercel HTTP entrypoint", () => {
  it("serves release metadata as uncached JSON", async () => {
    const response = await fetch(`${origin}/api/release-info`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toHaveProperty("serviceWorkerVersion");
  });

  it("keeps anonymous authentication anonymous through tRPC", async () => {
    const response = await fetch(`${origin}/api/trpc/auth.me`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      result: { data: { json: null } },
    });
  });

  it("delivers the packaged worker with private revalidation and root scope", async () => {
    const response = await fetch(`${origin}/api/service-worker-v15.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
    expect(response.headers.get("service-worker-allowed")).toBe("/");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    expect(await response.text()).toBe(
      readFileSync(path.join(fixture, "dist/public/sw.js"), "utf8")
    );
  });

  it("does not turn an unknown API route into the SPA document", async () => {
    const response = await fetch(`${origin}/api/does-not-exist`);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});
