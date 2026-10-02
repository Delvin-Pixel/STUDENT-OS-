import { encodeOAuthState } from "@shared/const";
import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { registerOAuthRoutes } from "./_core/oauth";

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
  await Promise.all(
    servers
      .splice(0)
      .map(
        server => new Promise<void>(resolve => server.close(() => resolve()))
      )
  );
});

describe("mobile OAuth state contract", () => {
  it("issues a host-only, short-lived Lax nonce cookie from the same-origin start route", async () => {
    await withOAuthServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/oauth/start`, {
        method: "POST",
        headers: { Origin: baseUrl, Accept: "application/json" },
      });
      const body = (await response.json()) as { nonce?: string };
      const setCookie = response.headers.get("set-cookie") ?? "";
      expect(response.status).toBe(200);
      expect(body.nonce).toMatch(/^[0-9a-f-]{36}$/);
      expect(setCookie).toContain("__Host-oauth_state=");
      expect(setCookie).toContain("Path=/");
      expect(setCookie).toContain("Max-Age=1800");
      expect(setCookie).toContain("SameSite=Lax");
      expect(setCookie).toContain("Secure");
      expect(setCookie).toContain("__Host-oauth_callback=");
    });
  });

  it("still issues a nonce when a mobile webview sends a proxy-different Origin", async () => {
    await withOAuthServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/oauth/start`, {
        method: "POST",
        headers: {
          Origin: "https://mobile-webview.invalid",
          Accept: "application/json",
        },
      });
      const body = (await response.json()) as { nonce?: string };
      expect(response.status).toBe(200);
      expect(body.nonce).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  it("rejects mismatched nonce and redirect binding without calling token exchange", async () => {
    await withOAuthServer(async baseUrl => {
      const state = encodeOAuthState({
        redirectUri: `${baseUrl}/api/oauth/callback`,
        nonce: "nonce-a",
      });
      const response = await fetch(
        `${baseUrl}/api/oauth/callback?code=fake&state=${encodeURIComponent(state)}`,
        {
          headers: {
            cookie:
              "__Host-oauth_state=nonce-b; __Host-oauth_callback=" +
              encodeURIComponent(`${baseUrl}/api/oauth/callback`),
            Accept: "application/json",
          },
        }
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "invalid oauth state" });
    });
  });

  it("does not accept a valid nonce with a callback redirect for another origin", async () => {
    await withOAuthServer(async baseUrl => {
      const state = encodeOAuthState({
        redirectUri: "https://evil.example/api/oauth/callback",
        nonce: "nonce-a",
      });
      const response = await fetch(
        `${baseUrl}/api/oauth/callback?code=fake&state=${encodeURIComponent(state)}`,
        {
          headers: {
            cookie:
              "__Host-oauth_state=nonce-a; __Host-oauth_callback=" +
              encodeURIComponent(`${baseUrl}/api/oauth/callback`),
            Accept: "application/json",
          },
        }
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "invalid oauth state" });
    });
  });

  it("redirects browser callbacks with missing parameters to a recoverable landing URL", async () => {
    await withOAuthServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/oauth/callback`, {
        redirect: "manual",
        headers: { Accept: "text/html" },
      });
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(
        "/?authError=code%20and%20state%20are%20required"
      );
    });
  });

  it("rejects a start request whose claimed callback is not the requesting browser origin", async () => {
    await withOAuthServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/oauth/start`, {
        method: "POST",
        headers: {
          Origin: baseUrl,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          callbackUrl: "https://evil.example/api/oauth/callback",
        }),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "invalid oauth callback origin",
      });
      expect(response.headers.get("set-cookie")).toBeNull();
    });
  });
});
