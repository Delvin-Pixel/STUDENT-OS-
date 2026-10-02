import { COOKIE_NAME, encodeOAuthState } from "@shared/const";
import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { registerOAuthRoutes } from "./_core/oauth";
import { sdk } from "./_core/sdk";
import * as db from "./db";

const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

async function withOAuthServer<T>(run: (baseUrl: string) => Promise<T>) {
  const app = express();
  app.use(express.json());
  registerOAuthRoutes(app);
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  return run(`http://127.0.0.1:${address.port}`);
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers
      .splice(0)
      .map(
        server => new Promise<void>(resolve => server.close(() => resolve()))
      )
  );
});

describe("OAuth callback session handoff", () => {
  it("issues a session cookie that verifies on the next authenticated request", async () => {
    const originalSecret = ENV.cookieSecret;
    const originalAppId = ENV.appId;
    ENV.cookieSecret = "test-session-secret-with-at-least-thirty-two-bytes";
    ENV.appId = "student-os-test";

    try {
      vi.spyOn(sdk, "exchangeCodeForToken").mockResolvedValue({
        accessToken: "access-token",
      } as any);
      vi.spyOn(sdk, "getUserInfo").mockResolvedValue({
        subject: "provider-account-1",
        name: "Student",
        email: "student@example.test",
      } as any);
      vi.spyOn(db, "upsertUser").mockResolvedValue(undefined as any);

      await withOAuthServer(async baseUrl => {
        const nonceResponse = await fetch(`${baseUrl}/api/oauth/start`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: baseUrl },
          body: JSON.stringify({
            callbackUrl: `${baseUrl}/api/oauth/callback`,
          }),
        });
        const startPayload = (await nonceResponse.json()) as {
          nonce: string;
          codeChallenge: string;
          codeChallengeMethod: "S256";
        };
        const nonce = startPayload.nonce;
        expect(startPayload.codeChallenge).toBeTruthy();
        expect(startPayload.codeChallengeMethod).toBe("S256");
        const pkceSetCookie = nonceResponse.headers.get("set-cookie") ?? "";
        const pkceVerifier = pkceSetCookie.match(
          /__Host-oauth_pkce=([^;]+)/
        )?.[1];
        expect(pkceVerifier).toBeTruthy();
        const state = encodeOAuthState({
          redirectUri: `${baseUrl}/api/oauth/callback`,
          nonce,
        });
        const response = await fetch(
          `${baseUrl}/api/oauth/callback?code=provider-code&state=${encodeURIComponent(state)}`,
          {
            redirect: "manual",
            headers: {
              cookie: `__Host-oauth_state=${nonce}; __Host-oauth_callback=${encodeURIComponent(`${baseUrl}/api/oauth/callback`)}; __Host-oauth_pkce=${pkceVerifier}`,
              Accept: "text/html",
            },
          }
        );
        const setCookie = response.headers.get("set-cookie") ?? "";
        const sessionToken = setCookie.match(
          new RegExp(`${COOKIE_NAME}=([^;]+)`)
        )?.[1];

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe("/");
        expect(sessionToken).toBeTruthy();
        await expect(sdk.verifySession(sessionToken)).resolves.toMatchObject({
          subject: "provider-account-1",
          appId: "student-os-test",
          name: "Student",
        });
      });
    } finally {
      ENV.cookieSecret = originalSecret;
      ENV.appId = originalAppId;
    }
  });
});
