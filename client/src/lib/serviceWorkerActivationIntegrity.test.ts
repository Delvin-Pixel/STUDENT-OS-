import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("service-worker activation safety", () => {
  const sw = readFileSync(
    resolve(process.cwd(), "client/public/sw.js"),
    "utf8"
  );

  it("waits for precaching before skipWaiting", () => {
    const installStart = sw.indexOf('self.addEventListener("install"');
    const activateStart = sw.indexOf('self.addEventListener("activate"');
    expect(installStart).toBeGreaterThanOrEqual(0);
    expect(activateStart).toBeGreaterThan(installStart);

    const installBlock = sw.slice(installStart, activateStart);
    const precacheStart = installBlock.indexOf("await cache.addAll");
    const skipWaitingStart = installBlock.indexOf("await self.skipWaiting");
    expect(precacheStart).toBeGreaterThanOrEqual(0);
    expect(skipWaitingStart).toBeGreaterThanOrEqual(0);
    expect(precacheStart).toBeLessThan(skipWaitingStart);
  });

  it("limits manifest precache entries to same-origin absolute paths", () => {
    expect(sw).toContain('value.startsWith("/")');
    expect(sw).toContain('!value.startsWith("//")');
  });

  it("only claims clients after old Student OS caches are removed", () => {
    const activateStart = sw.indexOf('self.addEventListener("activate"');
    expect(activateStart).toBeGreaterThanOrEqual(0);

    const activateBlock = sw.slice(activateStart);
    const cleanupStart = activateBlock.indexOf("Promise.all");
    const claimStart = activateBlock.indexOf("self.clients.claim()");
    expect(cleanupStart).toBeGreaterThanOrEqual(0);
    expect(claimStart).toBeGreaterThanOrEqual(0);
    expect(claimStart).toBeGreaterThan(cleanupStart);
  });
});
