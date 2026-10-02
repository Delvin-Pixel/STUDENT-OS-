import {
  createECDH,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { canBuildWebPushPayload } from "./webPush";

const originalKeys = {
  publicKey: ENV.vapidPublicKey,
  privateKey: ENV.vapidPrivateKey,
};
beforeEach(() => {
  // Exercise the actual signing path without requiring production credentials.
  const pair = createECDH("prime256v1");
  pair.generateKeys();
  ENV.vapidPublicKey = pair.getPublicKey().toString("base64url");
  ENV.vapidPrivateKey = pair.getPrivateKey().toString("base64url");
});
afterEach(() => {
  ENV.vapidPublicKey = originalKeys.publicKey;
  ENV.vapidPrivateKey = originalKeys.privateKey;
});

describe("VAPID credentials", () => {
  it("forms a matching P-256 signing pair for authenticated web push delivery", () => {
    expect(ENV.vapidPublicKey).not.toBe("");
    expect(ENV.vapidPrivateKey).not.toBe("");

    const publicBytes = Buffer.from(ENV.vapidPublicKey, "base64url");
    expect(publicBytes).toHaveLength(65);
    expect(publicBytes[0]).toBe(4);

    const x = publicBytes.subarray(1, 33).toString("base64url");
    const y = publicBytes.subarray(33, 65).toString("base64url");
    const privateKey = createPrivateKey({
      key: { kty: "EC", crv: "P-256", x, y, d: ENV.vapidPrivateKey },
      format: "jwk",
    });
    const publicKey = createPublicKey({
      key: { kty: "EC", crv: "P-256", x, y },
      format: "jwk",
    });
    const payload = Buffer.from("student-os-push-credential-check");
    const signature = sign("sha256", payload, privateKey);

    expect(verify("sha256", payload, publicKey, signature)).toBe(true);
    expect(canBuildWebPushPayload()).toBe(true);
  });
});
