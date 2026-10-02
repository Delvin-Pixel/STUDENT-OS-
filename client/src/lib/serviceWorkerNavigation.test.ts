import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

async function notificationTarget(targetUrl: string) {
  const handlers: Record<string, (event: any) => void> = {};
  const opened: string[] = [];
  const origin = "https://studentos.example.test";
  const context = {
    URL,
    self: {
      location: { origin },
      addEventListener: (name: string, handler: (event: any) => void) => {
        handlers[name] = handler;
      },
      skipWaiting: () => undefined,
      clients: { claim: () => Promise.resolve() },
      registration: { showNotification: () => Promise.resolve() },
    },
    clients: {
      matchAll: async () => [],
      openWindow: async (url: string) => {
        opened.push(url);
        return undefined;
      },
    },
  };
  const source = readFileSync(
    fileURLToPath(new URL("../../public/sw.js", import.meta.url)),
    "utf8"
  );
  vm.runInNewContext(source, context);
  let completion: Promise<unknown> | undefined;
  handlers.notificationclick({
    notification: { close: () => undefined, data: { targetUrl } },
    waitUntil: (work: Promise<unknown>) => {
      completion = work;
    },
  });
  await completion;
  return opened[0];
}

describe("service worker notification navigation", () => {
  it("keeps protected storage routes outside the device-wide cache path", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../public/sw.js", import.meta.url)),
      "utf8"
    );
    expect(source).toContain('url.pathname.startsWith("/storage/")');
  });

  it("falls back to the Student OS root for an external notification payload URL", async () => {
    await expect(
      notificationTarget("https://untrusted.example/phish")
    ).resolves.toBe("https://studentos.example.test/");
  });

  it("opens a same-origin Student OS route when the reminder payload is valid", async () => {
    await expect(notificationTarget("/today?reminder=study")).resolves.toBe(
      "https://studentos.example.test/today?reminder=study"
    );
  });
});
