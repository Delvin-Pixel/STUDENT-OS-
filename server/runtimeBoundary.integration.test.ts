import { createServer, type Server } from "node:http";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createApp } from "./_core/app";
import { sdk } from "./_core/sdk";
import * as workspace from "./workspace";

let server: Server;
let origin: string;
beforeAll(async () => {
  server = createServer(createApp());
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  origin = `http://127.0.0.1:${address.port}`;
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function assertPrivate(response: Response) {
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("cdn-cache-control")).toBe("no-store");
  expect(response.headers.get("vercel-cdn-cache-control")).toBe("no-store");
}

function loadUrl(account: string) {
  return `${origin}/api/trpc/workspace.load?input=${encodeURIComponent(JSON.stringify({ json: { cacheScope: account } }))}`;
}

describe("combined runtime authentication and privacy boundary", () => {
  it.each([undefined, "invalid-session"])(
    "rejects missing/invalid cookie %s before workspace access",
    async cookie => {
      const read = vi.spyOn(workspace, "getWorkspace");
      const response = await fetch(loadUrl("account-a"), {
        headers: cookie ? { cookie: `app_session_id=${cookie}` } : {},
      });
      expect(response.status).toBe(401);
      assertPrivate(response);
      expect(read).not.toHaveBeenCalled();
    }
  );

  it("rejects stale account A load after server session switches to B", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({
      openId: "account-b",
      role: "user",
    } as any);
    const read = vi.spyOn(workspace, "getWorkspace");
    const response = await fetch(loadUrl("account-a"));
    expect(response.status).toBe(403);
    assertPrivate(response);
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects an already dispatched A write received with a B session before persistence", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({
      openId: "account-b",
      role: "user",
    } as any);
    const write = vi.spyOn(workspace, "setWorkspace");
    const response = await fetch(`${origin}/api/trpc/workspace.save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        json: { expectedAccountId: "account-a", workspace: {}, revision: 0 },
      }),
    });
    expect(response.status).toBe(403);
    assertPrivate(response);
    expect(write).not.toHaveBeenCalled();
  });

  it("fails closed when authentication persistence fails", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockRejectedValue(
      new Error("private-database-detail")
    );
    const read = vi.spyOn(workspace, "getWorkspace");
    const response = await fetch(loadUrl("account-a"));
    expect(response.status).toBe(401);
    assertPrivate(response);
    expect(await response.text()).not.toContain("private-database-detail");
    expect(read).not.toHaveBeenCalled();
  });

  it("returns private sanitized JSON for malformed request bodies", async () => {
    const response = await fetch(`${origin}/api/trpc/workspace.save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"private-body-marker":',
    });
    expect(response.status).toBe(400);
    assertPrivate(response);
    const body = await response.text();
    expect(body).not.toContain("private-body-marker");
    expect(body).not.toContain("SyntaxError");
    expect(JSON.parse(body)).toEqual({ error: "Invalid request body" });
  });
  it("rejects unsupported body encoding without an HTML error page", async () => {
    const response = await fetch(`${origin}/api/trpc/workspace.save`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-encoding": "unsupported-test",
      },
      body: "{}",
    });
    expect(response.status).toBe(415);
    assertPrivate(response);
    expect(await response.json()).toEqual({
      error: "Unsupported request encoding",
    });
  });
});
