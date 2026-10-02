import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

describe("auth.me", () => {
  it("returns identity metadata without serializing the private workspace blob", async () => {
    const ctx = {
      user: {
        id: 1,
        openId: "student-a",
        name: "Student A",
        email: "student@example.test",
        loginMethod: "oauth",
        role: "user",
        workspace: '{"tasks":[{"title":"private"}]}',
        workspaceRevision: 7,
        workspaceSchemaVersion: 2,
        workspaceUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} },
      res: {},
    } as TrpcContext;

    const result = await appRouter.createCaller(ctx).auth.me();
    expect(result).toMatchObject({ openId: "student-a", name: "Student A" });
    expect(result).not.toHaveProperty("workspace");
    expect(result).not.toHaveProperty("workspaceRevision");
  });
});
