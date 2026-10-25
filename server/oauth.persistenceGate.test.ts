import { COOKIE_NAME, encodeOAuthState } from "@shared/const";
import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerOAuthRoutes } from "./_core/oauth";
import { sdk } from "./_core/sdk";
import * as db from "./db";

const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

async function callbackWithValidTransaction() {
  const app = express();
  app.use(express.json());
  registerOAuthRoutes(app);
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const callbackUrl = `${baseUrl}/api/oauth/callback`;

  const start = await fetch(`${baseUrl}/api/oauth/start`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ callbackUrl }),
  });
  expect(start.status).toBe(200);
  const payload = (await start.json()) as {
    nonce: string;
  };
  const cookies = start.headers.get("set-cookie") ?? "";
  const verifier = cookies.match(/__Host-oauth_pkce=([^;]+)/)?.[1];
  expect(verifier).toBeTruthy();
  const state = encodeOAuthState({
    redirectUri: callbackUrl,
    nonce: payload.nonce,
  });

  return fetch(
    `${callbackUrl}?code=test-provider-code&state=${encodeURIComponent(state)}`,
    {
      redirect: "manual",
      headers: {
        cookie: [
          `__Host-oauth_state=${payload.nonce}`,
          `__Host-oauth_callback=${encodeURIComponent(callbackUrl)}`,
          `__Host-oauth_pkce=${verifier}`,
        ].join("; "),
        Accept: "application/json",
      },
    }
  );
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

function providerResponse() {
  vi.spyOn(sdk, "exchangeCodeForToken").mockResolvedValue({
    accessToken: "unit-test-oauth-token",
  } as any);
  vi.spyOn(sdk, "getUserInfo").mockResolvedValue({
    subject: "provider-owner-one",
    name: "Example learner",
    email: "example@test.invalid",
  } as any);
  return vi.spyOn(sdk, "createSessionToken");
}

describe("B58.1 OAuth persistence gate", () => {
  it("does not issue a session cookie if database account writes fail", async () => {
    const issueCookie = providerResponse();
    const write = vi
      .spyOn(db, "upsertUser")
      .mockRejectedValue(new Error("test database offline"));
    const read = vi.spyOn(db, "getUserByOpenId");
    const response = await callbackWithValidTransaction();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "OAuth callback failed",
    });
    expect(response.headers.get("set-cookie") ?? "").not.toContain(
      `${COOKIE_NAME}=`
    );
    expect(write).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
    expect(issueCookie).not.toHaveBeenCalled();
  });

  it("refuses a login if a claimed successful write cannot be read back", async () => {
    const issueCookie = providerResponse();
    vi.spyOn(db, "upsertUser").mockResolvedValue(undefined);
    const read = vi.spyOn(db, "getUserByOpenId").mockResolvedValue(undefined);
    const response = await callbackWithValidTransaction();

    expect(response.status).toBe(500);
    expect(read).toHaveBeenCalledWith("provider-owner-one");
    expect(response.headers.get("set-cookie") ?? "").not.toContain(
      `${COOKIE_NAME}=`
    );
    expect(issueCookie).not.toHaveBeenCalled();
  });

  it("refuses a mismatched persisted account instead of granting a different identity", async () => {
    const issueCookie = providerResponse();
    vi.spyOn(db, "upsertUser").mockResolvedValue(undefined);
    vi.spyOn(db, "getUserByOpenId").mockResolvedValue({
      openId: "provider-owner-two",
    } as any);
    const response = await callbackWithValidTransaction();

    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie") ?? "").not.toContain(
      `${COOKIE_NAME}=`
    );
    expect(issueCookie).not.toHaveBeenCalled();
  });

  it("does not issue a session if the account read throws after the write", async () => {
    const issueCookie = providerResponse();
    vi.spyOn(db, "upsertUser").mockResolvedValue(undefined);
    vi.spyOn(db, "getUserByOpenId").mockRejectedValue(
      new Error("test read failure")
    );
    const response = await callbackWithValidTransaction();

    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie") ?? "").not.toContain(
      `${COOKIE_NAME}=`
    );
    expect(issueCookie).not.toHaveBeenCalled();
  });
});
