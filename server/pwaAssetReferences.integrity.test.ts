import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const publicDir = fileURLToPath(new URL("../client/public/", import.meta.url));
const serviceWorker = readFileSync(
  new URL("../client/public/sw.js", import.meta.url),
  "utf8"
);
const browserNotification = readFileSync(
  new URL("../client/src/lib/browserNotif.ts", import.meta.url),
  "utf8"
);
const indexHtml = readFileSync(
  new URL("../client/index.html", import.meta.url),
  "utf8"
);
const manifest = JSON.parse(
  readFileSync(
    new URL("../client/public/manifest.webmanifest", import.meta.url),
    "utf8"
  )
) as { icons: Array<{ src: string }> };

function publicPathExists(path: string) {
  return path.startsWith("/") && existsSync(`${publicDir}${path.slice(1)}`);
}

describe("PWA production asset references", () => {
  it("keeps manifest, Apple touch, and notification assets resolvable from the public tree", () => {
    expect(manifest.icons).toHaveLength(2);
    for (const icon of manifest.icons)
      expect(publicPathExists(icon.src)).toBe(true);
    expect(indexHtml).toContain('href="/icons/icon-192.png"');
    expect(publicPathExists("/icons/icon-192.png")).toBe(true);
    expect(publicPathExists("/icons/icon-512.png")).toBe(true);
  });

  it("never emits obsolete root-level notification icon paths", () => {
    for (const source of [serviceWorker, browserNotification]) {
      expect(source).toContain('icon: "/icons/icon-192.png"');
      expect(source).toContain('badge: "/icons/icon-192.png"');
      expect(source).not.toContain('"/icon-192.png"');
    }
  });
});
