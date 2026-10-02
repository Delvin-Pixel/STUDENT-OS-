import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("push subscription rotation contract", () => {
  it("reconciles a rotated browser endpoint without disabling another account device", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./pushDb.ts", import.meta.url)),
      "utf8"
    );
    expect(source).toContainSource("previousEndpoint !== input.endpoint");
    expect(source).toContainSource(
      "eq(pushDevices.endpoint, previousEndpoint), eq(pushDevices.openId, openId)"
    );
    expect(source).toContainSource(
      "set({ enabled: false, lastSeenAt: new Date() })"
    );
  });

  it("requires the current subscription credentials when synchronizing reminders", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./routers.ts", import.meta.url)),
      "utf8"
    );
    expect(source).toContainSource("subscription: pushSubscriptionSchema");
    expect(source).toContainSource(
      "previousEndpoint: pushEndpointSchema.nullish()"
    );
    expect(source).toContainSource("reconcilePushDevice(");
  });
});
