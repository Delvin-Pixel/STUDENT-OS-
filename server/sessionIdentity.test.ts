import { COOKIE_NAME } from "@shared/const";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import {
  assertOAuthUserMatchesSession,
  isValidSessionPayload,
  SDKServer,
  validatedSessionSecret,
} from "./_core/sdk";
import * as db from "./db";

describe("OAuth session identity", () => {
  const originalCookieSecret = ENV.cookieSecret;
  const originalAppId = ENV.appId;
  beforeEach(() => {
    ENV.appId = "student-os-test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ENV.cookieSecret = originalCookieSecret;
    ENV.appId = originalAppId;
  });
  it("accepts a valid identity whose provider omitted an optional display name", () => {
    expect(
      isValidSessionPayload({
        subject: "name-optional-user",
        appId: "student-os",
        name: "",
      })
    ).toBe(true);
    expect(
      isValidSessionPayload({
        subject: "name-optional-user",
        appId: "student-os",
      })
    ).toBe(false);
  });

  it("rejects a signed-payload shape from another application when an audience is expected", () => {
    const payload = {
      subject: "name-optional-user",
      appId: "different-app",
      name: "Student",
    };
    expect(isValidSessionPayload(payload, "student-os")).toBe(false);
    expect(isValidSessionPayload(payload, "different-app")).toBe(true);
    expect(isValidSessionPayload({ ...payload, appId: "" }, "")).toBe(false);
  });

  it("does not allow OAuth user sync to substitute a different account identity", () => {
    expect(() =>
      assertOAuthUserMatchesSession("account-a", "account-b")
    ).toThrow("did not match");
    expect(() =>
      assertOAuthUserMatchesSession("account-a", "account-a")
    ).not.toThrow();
  });

  it("rejects a valid signed session supplied only through a bearer header", async () => {
    ENV.cookieSecret = "test-session-secret-with-at-least-thirty-two-bytes";
    const server = new SDKServer();
    const token = await server.createSessionToken("account-a");

    await expect(
      server.authenticateRequest({
        headers: { authorization: `Bearer ${token}` },
      } as any)
    ).rejects.toThrow("Invalid session cookie");
  });

  it("continues to authenticate a valid signed cookie without consulting a bearer header", async () => {
    ENV.cookieSecret = "test-session-secret-with-at-least-thirty-two-bytes";
    const server = new SDKServer();
    const token = await server.createSessionToken("account-a");
    const user = {
      id: 1,
      openId: "account-a",
      name: "Amina",
      email: null,
      loginMethod: null,
      role: "user",
      workspace: null,
      workspaceSchemaVersion: 4,
      workspaceRevision: 0,
      workspaceUpdatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    vi.spyOn(db, "getUserByOpenId").mockResolvedValue(user as any);
    vi.spyOn(db, "upsertUser").mockResolvedValue(undefined as any);

    await expect(
      server.authenticateRequest({
        headers: {
          cookie: `${COOKIE_NAME}=${token}`,
          authorization: "Bearer ignored",
        },
      } as any)
    ).resolves.toMatchObject({ openId: "account-a" });
  });

  it("derives a stable 256-bit signing key from a platform-compatible 22-byte secret", async () => {
    const platformSecret = "1234567890123456789012";
    ENV.cookieSecret = platformSecret;
    const server = new SDKServer();
    const token = await server.createSessionToken("account-a");

    expect(validatedSessionSecret(platformSecret)).toHaveLength(32);
    await expect(server.verifySession(token)).resolves.toMatchObject({
      subject: "account-a",
    });
  });
});
