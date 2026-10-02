import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  hkdfSync,
  randomBytes,
  sign,
} from "node:crypto";
import { isIP } from "node:net";
import { ENV } from "./_core/env";

export type WebPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};
export type WebPushPayload = {
  title: string;
  body: string;
  targetUrl: string;
  tag: string;
  vibration?: number[];
};
const PUSH_SERVICE_TIMEOUT_MS = 8_000;
/** Browser-managed push services supported by the deployed Student OS clients. */
const ALLOWED_WEB_PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
]);

/** Browser push endpoints must be a normal public HTTPS origin, never a server-side request target supplied by a learner. */
export function isSafeWebPushEndpoint(value: string): boolean {
  try {
    const endpoint = new URL(value);
    const hostname = endpoint.hostname.toLowerCase();
    const ipCandidate = hostname.replace(/^\[|\]$/g, "");
    return (
      endpoint.protocol === "https:" &&
      !endpoint.username &&
      !endpoint.password &&
      !endpoint.port &&
      Boolean(hostname) &&
      isIP(ipCandidate) === 0 &&
      ALLOWED_WEB_PUSH_HOSTS.has(hostname)
    );
  } catch {
    return false;
  }
}

export function assertSafeWebPushEndpoint(value: string) {
  if (!isSafeWebPushEndpoint(value)) {
    throw new Error(
      "Student OS can only use a standard public HTTPS browser-push endpoint."
    );
  }
}

/** A privacy-safe, user-requested delivery check that proves the installed device can receive a server push. */
export function buildPushConnectionTestPayload(
  vibration?: number[]
): WebPushPayload {
  return {
    title: "We’ve got you on check",
    body: "Student OS reminders are active on this device.",
    targetUrl: "/settings",
    tag: "studentos-push-activation-confirmation",
    vibration,
  };
}

const b64 = (input: Buffer) => input.toString("base64url");
const fromB64 = (input: string) => Buffer.from(input, "base64url");
const hmacExpand = (
  salt: Buffer,
  keyMaterial: Buffer,
  info: Buffer,
  length: number
) => Buffer.from(hkdfSync("sha256", keyMaterial, salt, info, length));

function vapidJwt(endpoint: string) {
  const publicBytes = fromB64(ENV.vapidPublicKey);
  const x = b64(publicBytes.subarray(1, 33));
  const y = b64(publicBytes.subarray(33, 65));
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", x, y, d: ENV.vapidPrivateKey },
    format: "jwk",
  });
  const header = b64(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64(
    Buffer.from(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: `mailto:${ENV.vapidSubject}`,
      })
    )
  );
  const unsigned = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${unsigned}.${b64(signature)}`;
}

function encryptPushPayload(
  subscription: WebPushSubscription,
  payload: WebPushPayload
) {
  const clientPublic = fromB64(subscription.p256dh);
  const authSecret = fromB64(subscription.auth);
  const ecdh = createECDH("prime256v1");
  const serverPublic = ecdh.generateKeys();
  const sharedSecret = ecdh.computeSecret(clientPublic);
  const ikm = hmacExpand(
    authSecret,
    sharedSecret,
    Buffer.concat([Buffer.from("WebPush: info\0"), clientPublic, serverPublic]),
    32
  );
  const salt = randomBytes(16);
  const cek = hmacExpand(
    salt,
    ikm,
    Buffer.from("Content-Encoding: aes128gcm\0"),
    16
  );
  const nonce = hmacExpand(
    salt,
    ikm,
    Buffer.from("Content-Encoding: nonce\0"),
    12
  );
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const plainText = Buffer.concat([
    Buffer.from(JSON.stringify(payload)),
    Buffer.from([2]),
  ]);
  const encrypted = Buffer.concat([
    cipher.update(plainText),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublic.length]),
    serverPublic,
    encrypted,
  ]);
}

export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: WebPushPayload
) {
  assertSafeWebPushEndpoint(subscription.endpoint);
  if (!ENV.vapidPublicKey || !ENV.vapidPrivateKey)
    throw new Error("VAPID credentials are not configured.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUSH_SERVICE_TIMEOUT_MS);
  try {
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
        Urgency: "high",
        Authorization: `vapid t=${vapidJwt(subscription.endpoint)}, k=${ENV.vapidPublicKey}`,
      },
      body: encryptPushPayload(subscription, payload),
      signal: controller.signal,
      redirect: "error",
    });
    return { ok: response.ok, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

export function canBuildWebPushPayload() {
  try {
    const publicBytes = ENV.vapidPublicKey
      ? fromB64(ENV.vapidPublicKey)
      : Buffer.alloc(0);
    if (
      publicBytes.length !== 65 ||
      publicBytes[0] !== 4 ||
      !ENV.vapidPrivateKey
    )
      return false;
    const x = b64(publicBytes.subarray(1, 33));
    const y = b64(publicBytes.subarray(33, 65));
    createPrivateKey({
      key: { kty: "EC", crv: "P-256", x, y, d: ENV.vapidPrivateKey },
      format: "jwk",
    });
    return true;
  } catch {
    return false;
  }
}
