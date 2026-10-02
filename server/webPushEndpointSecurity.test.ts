import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertSafeWebPushEndpoint, isSafeWebPushEndpoint } from "./webPush";

describe("web push endpoint security", () => {
  it("never follows a push-service redirect to another server-side request target", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./webPush.ts", import.meta.url)),
      "utf8"
    );
    expect(source).toContain('redirect: "error"');
  });

  it.each([
    "https://fcm.googleapis.com/fcm/send/device-a",
    "https://updates.push.services.mozilla.com/wpush/v2/device-a",
    "https://web.push.apple.com/QH4/device-a",
  ])("accepts a supported browser-push service endpoint: %s", endpoint => {
    expect(isSafeWebPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://push.example.test/subscriptions/device-a",
    "https://127.0.0.1/private",
    "https://[::1]/private",
    "https://localhost/private",
    "https://push.example.test/subscriptions/device-a",
    "https://fcm.googleapis.com.attacker.example/private",
    "https://push.example.test:8443/private",
    "https://user:password@push.example.test/private",
    "https://fcm.googleapis.com/fcm/send/é",
  ])("rejects an untrusted server-side request target: %s", endpoint => {
    expect(isSafeWebPushEndpoint(endpoint)).toBe(false);
    expect(() => assertSafeWebPushEndpoint(endpoint)).toThrow(
      "public HTTPS browser-push endpoint"
    );
  });
});
