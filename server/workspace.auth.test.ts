import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./workspace", () => ({
  getWorkspace: vi.fn(),
  setWorkspace: vi.fn(),
  clearWorkspace: vi.fn(),
  validateWorkspacePayload: vi.fn(),
}));

import { emptyState } from "../client/src/lib/storage";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import {
  clearWorkspace,
  getWorkspace,
  setWorkspace,
  validateWorkspacePayload,
} from "./workspace";

function contextFor(openId: string | null): TrpcContext {
  return {
    user: openId
      ? {
          id: 1,
          openId,
          email: `${openId}@example.test`,
          name: "Test Student",
          loginMethod: "oauth",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
          workspace: null,
          workspaceSchemaVersion: 4,
          workspaceRevision: 0,
          workspaceUpdatedAt: null,
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("workspace router authentication and ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a workspace load before reaching storage when no session exists", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.workspace.load()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(getWorkspace).not.toHaveBeenCalled();
  });

  it("rejects every learner AI surface before a provider request when no session exists", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(
      caller.dailyLessons.generate({
        subject: "Physics",
        branch: "Waves",
        topic: "Refraction",
        educationLevel: "Secondary",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller.studyAssistant.ask({ question: "Explain refraction" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller.learningDrafts.quiz({
        subject: "Physics",
        topic: "Waves",
        educationLevel: "Secondary",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects profile, material, push, and workspace private procedures when no session exists", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    const endpoint = "https://fcm.googleapis.com/fcm/send/subscription";
    const subscription = {
      endpoint,
      p256dh: "x".repeat(24),
      auth: "y".repeat(8),
    };
    const attempts = [
      caller.profilePhoto.upload({
        dataUrl: `data:image/png;base64,${"a".repeat(32)}`,
      }),
      caller.profilePhoto.accessUrl({
        storageKey: "student-os/profile-photos/account-a/photo.png",
      }),
      caller.studyMaterials.upload({
        title: "Chapter",
        subject: "Physics",
        fileName: "chapter.pdf",
        dataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
      }),
      caller.studyMaterials.accessUrl({
        storageKey: "account-a/study-materials/chapter.pdf",
      }),
      caller.studyMaterials.summary({
        storageKey: "account-a/study-materials/chapter.pdf",
      }),
      caller.studyMaterials.practiceQuestions({
        storageKey: "account-a/study-materials/chapter.pdf",
      }),
      caller.push.config(),
      caller.push.register(subscription),
      caller.push.syncReminders({ subscription, reminders: [] }),
      caller.push.disable({ endpoint }),
      caller.push.deliveryHistory({ endpoint, cacheScope: "forged-account-a" }),
      caller.push.testDelivery({ endpoint }),
    ];
    for (const attempt of attempts)
      await expect(attempt).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("loads only the workspace identified by the trusted authenticated context", async () => {
    vi.mocked(getWorkspace).mockResolvedValue({
      openId: "account-aminah",
      workspace: null,
      revision: 0,
      schemaVersion: 1,
      updatedAt: null,
    });
    const caller = appRouter.createCaller(contextFor("account-aminah"));
    await caller.workspace.load({ cacheScope: "forged-other-account" });
    expect(getWorkspace).toHaveBeenCalledWith("account-aminah");
  });

  it("rejects a workspace save before validation or storage when no session exists", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(
      caller.workspace.save({ workspace: emptyState(), revision: 0 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(validateWorkspacePayload).not.toHaveBeenCalled();
    expect(setWorkspace).not.toHaveBeenCalled();
  });

  it("uses the authenticated account rather than browser-controlled data when saving", async () => {
    vi.mocked(validateWorkspacePayload).mockReturnValue({
      ok: true,
      text: '{"canonical":true}',
    });
    vi.mocked(setWorkspace).mockResolvedValue({
      ok: true,
      revision: 4,
      updatedAt: new Date("2026-08-23T00:00:00.000Z"),
    });
    const result = await appRouter
      .createCaller(contextFor("account-aminah"))
      .workspace.save({ workspace: emptyState(), revision: 3 });
    expect(setWorkspace).toHaveBeenCalledWith(
      "account-aminah",
      '{"canonical":true}',
      3
    );
    expect(result).toMatchObject({ success: true, revision: 4 });
  });

  it("rejects a malformed workspace without calling persistence", async () => {
    vi.mocked(validateWorkspacePayload).mockReturnValue({
      ok: false,
      reason:
        "workspace does not match the supported Student OS data format (tasks.0.status)",
    });
    const result = await appRouter
      .createCaller(contextFor("account-aminah"))
      .workspace.save({ workspace: { forged: true }, revision: 3 });
    expect(result).toMatchObject({
      success: false,
      reason: expect.stringContaining("workspace does not match"),
    });
    expect(setWorkspace).not.toHaveBeenCalled();
  });

  it("returns the current canonical cloud workspace only after a trusted revision conflict", async () => {
    vi.mocked(validateWorkspacePayload).mockReturnValue({
      ok: true,
      text: '{"canonical":true}',
    });
    vi.mocked(setWorkspace).mockResolvedValue({
      ok: false,
      reason: "conflict",
      revision: 5,
      workspace: '{"tasks":[]}',
    });
    const result = await appRouter
      .createCaller(contextFor("account-aminah"))
      .workspace.save({ workspace: emptyState(), revision: 3 });
    expect(result).toEqual({
      success: false,
      reason: "conflict",
      revision: 5,
      workspace: { tasks: [] },
    });
  });

  it("rejects remote workspace deletion before storage when no session exists", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.workspace.clear()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(clearWorkspace).not.toHaveBeenCalled();
  });

  it("deletes only the trusted authenticated account workspace", async () => {
    vi.mocked(clearWorkspace).mockResolvedValue({
      ok: true,
      revision: 8,
      updatedAt: new Date("2026-08-22T00:00:00.000Z"),
    });
    const result = await appRouter
      .createCaller(contextFor("account-aminah"))
      .workspace.clear();
    expect(clearWorkspace).toHaveBeenCalledWith("account-aminah");
    expect(result).toMatchObject({ success: true, revision: 8 });
  });
});
