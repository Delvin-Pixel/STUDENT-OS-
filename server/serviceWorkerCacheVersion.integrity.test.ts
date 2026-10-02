import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const serviceWorker = readFileSync(
  fileURLToPath(new URL("../client/public/sw.js", import.meta.url)),
  "utf8"
);
const bootstrap = readFileSync(
  fileURLToPath(new URL("../client/src/main.tsx", import.meta.url)),
  "utf8"
);
const workerVersion = readFileSync(
  fileURLToPath(
    new URL("../client/src/lib/serviceWorkerVersion.ts", import.meta.url)
  ),
  "utf8"
);

describe("service-worker release cache", () => {
  it("uses a new cache version and replaces only prior Student OS shells on activation", async () => {
    expect(serviceWorker).toContain('const CACHE = "studentos-v15"');
    expect(serviceWorker).toContain("self.skipWaiting()");
    expect(serviceWorker).toContain("self.clients.claim()");
    const deleted: string[] = [];
    let activate:
      | ((event: { waitUntil(promise: Promise<unknown>): void }) => void)
      | undefined;
    let completion: Promise<unknown> | undefined;
    let claimed = false;
    runInNewContext(serviceWorker, {
      self: {
        addEventListener: (name: string, handler: typeof activate) => {
          if (name === "activate") activate = handler;
        },
        clients: {
          claim: () => {
            claimed = true;
          },
        },
      },
      caches: {
        keys: async () => ["studentos-v14", "studentos-v15", "unrelated-app"],
        delete: async (key: string) => {
          deleted.push(key);
          return true;
        },
      },
    });
    expect(activate).toBeTypeOf("function");
    activate!({
      waitUntil: promise => {
        completion = promise;
      },
    });
    await completion;
    expect(deleted).toEqual(["studentos-v14"]);
    expect(claimed).toBe(true);
  });

  it("requires a complete shell before activation and never replaces the offline shell with a failed navigation", () => {
    expect(serviceWorker).toContain('"/icons/icon-192.png"');
    expect(serviceWorker).toContain('"/icons/icon-512.png"');
    expect(serviceWorker).toContain(
      "cache.addAll([...new Set([...SHELL, ...emittedAssets])])"
    );
    expect(serviceWorker).toContain(
      'const PRECACHE_MANIFEST = "/precache.json"'
    );
    expect(serviceWorker).not.toContain("cache.addAll(SHELL).catch");
    expect(serviceWorker).toContain("if (res.ok) {");
    expect(serviceWorker).toContain('cache.put("/", clone)');
  });

  it("registers each worker generation through a versioned URL when intermediary caches retain static worker scripts", () => {
    expect(workerVersion).toContain('SERVICE_WORKER_VERSION = "studentos-v15"');
    expect(bootstrap).toContain(
      '/api/service-worker-${SERVICE_WORKER_VERSION.replace("studentos-", "")}.js'
    );
    expect(bootstrap).toContain('scope: "/"');
    expect(bootstrap).toContain('updateViaCache: "none"');
  });
});
