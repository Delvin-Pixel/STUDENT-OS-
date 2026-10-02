import { beforeEach, describe, expect, it, vi } from "vitest";

const ownedDevices = vi.hoisted(() => ({
  owners: new Map<string, string>(),
  enabled: new Map<string, boolean>(),
  reminders: new Map<string, number>(),
}));

vi.mock("./pushDb", () => ({
  activatePushDevice: vi.fn(
    async (
      input: { endpoint: string },
      reminders: unknown[],
      openId: string
    ) => {
      const owner = ownedDevices.owners.get(input.endpoint);
      if (owner && owner !== openId)
        throw new Error(
          "This phone is already registered to another Student OS account."
        );
      ownedDevices.owners.set(input.endpoint, openId);
      ownedDevices.enabled.set(input.endpoint, true);
      ownedDevices.reminders.set(input.endpoint, reminders.length);
      return { endpoint: input.endpoint, scheduled: reminders.length };
    }
  ),
  disablePushDevice: vi.fn(async (endpoint: string, openId: string) => {
    if (ownedDevices.owners.get(endpoint) === openId)
      ownedDevices.enabled.set(endpoint, false);
  }),
  getEnabledPushDevice: vi.fn(),
  getPushDeliveryHistory: vi.fn(async (endpoint: string, openId: string) =>
    ownedDevices.owners.get(endpoint) === openId
      ? [
          {
            kind: "test",
            status: "accepted",
            responseCode: 201,
            createdAt: new Date(),
          },
        ]
      : []
  ),
  pushDeliveryStatusFromResponse: vi.fn(),
  recordPushDeliveryHistory: vi.fn(),
  replaceDevicePushReminders: vi.fn(
    async (endpoint: string, reminders: unknown[], openId: string) => {
      if (ownedDevices.owners.get(endpoint) !== openId)
        throw new Error("Register this device before scheduling reminders.");
      ownedDevices.reminders.set(endpoint, reminders.length);
      return { scheduled: reminders.length };
    }
  ),
  reconcilePushDevice: vi.fn(
    async (
      input: { endpoint: string },
      reminders: unknown[],
      openId: string
    ) => {
      const owner = ownedDevices.owners.get(input.endpoint);
      if (owner && owner !== openId)
        throw new Error(
          "This phone is already registered to another Student OS account."
        );
      ownedDevices.owners.set(input.endpoint, openId);
      ownedDevices.enabled.set(input.endpoint, true);
      ownedDevices.reminders.set(input.endpoint, reminders.length);
      return { endpoint: input.endpoint, scheduled: reminders.length };
    }
  ),
  upsertPushDevice: vi.fn(
    async (input: { endpoint: string }, openId: string) => {
      const owner = ownedDevices.owners.get(input.endpoint);
      if (owner && owner !== openId)
        throw new Error(
          "This phone is already registered to another Student OS account."
        );
      ownedDevices.owners.set(input.endpoint, openId);
      ownedDevices.enabled.set(input.endpoint, true);
      return { id: 1, endpoint: input.endpoint, openId };
    }
  ),
}));

import type { TrpcContext } from "./_core/context";
import {
  activatePushDevice,
  disablePushDevice,
  getPushDeliveryHistory,
  reconcilePushDevice,
  upsertPushDevice,
} from "./pushDb";
import { appRouter } from "./routers";

const endpoint = "https://fcm.googleapis.com/fcm/send/subscription-a";
const subscription = { endpoint, p256dh: "x".repeat(24), auth: "y".repeat(12) };

function contextFor(openId: string | null): TrpcContext {
  return {
    user: openId
      ? {
          id: 1,
          openId,
          name: "Test Student",
          email: `${openId}@example.test`,
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

describe("push router ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ownedDevices.owners.clear();
    ownedDevices.enabled.clear();
    ownedDevices.reminders.clear();
  });

  it("rejects unauthenticated registration before the push store is contacted", async () => {
    await expect(
      appRouter.createCaller(contextFor(null)).push.register(subscription)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(upsertPushDevice).not.toHaveBeenCalled();
  });

  it("passes the server-authenticated account to registration, scheduling, and history regardless of cache scope", async () => {
    await appRouter
      .createCaller(contextFor("account-a"))
      .push.register(subscription);
    await appRouter
      .createCaller(contextFor("account-a"))
      .push.syncReminders({ subscription, reminders: [] });
    await appRouter
      .createCaller(contextFor("account-a"))
      .push.deliveryHistory({ endpoint, cacheScope: "forged-account-b" });
    expect(upsertPushDevice).toHaveBeenCalledWith(subscription, "account-a");
    expect(reconcilePushDevice).toHaveBeenCalledWith(
      subscription,
      [],
      "account-a",
      undefined
    );
    expect(getPushDeliveryHistory).toHaveBeenCalledWith(endpoint, "account-a");
  });

  it("atomically activates a device and its first reminder plan under the authenticated account", async () => {
    const caller = appRouter.createCaller(contextFor("account-a"));
    await expect(
      caller.push.activate({ subscription, reminders: [] })
    ).resolves.toEqual({ endpoint, scheduled: 0 });
    expect(activatePushDevice).toHaveBeenCalledWith(
      subscription,
      [],
      "account-a"
    );
    await expect(
      appRouter
        .createCaller(contextFor("account-b"))
        .push.activate({ subscription, reminders: [] })
    ).rejects.toThrow("already registered");
  });

  it("prevents Account B from claiming, scheduling, reading, or disabling Account A's endpoint", async () => {
    const accountA = appRouter.createCaller(contextFor("account-a"));
    const accountB = appRouter.createCaller(contextFor("account-b"));
    await accountA.push.register(subscription);
    await accountA.push.syncReminders({ subscription, reminders: [] });
    await expect(accountB.push.register(subscription)).rejects.toThrow(
      "already registered"
    );
    await expect(
      accountB.push.syncReminders({ subscription, reminders: [] })
    ).rejects.toThrow("already registered");
    await expect(
      accountB.push.deliveryHistory({ endpoint, cacheScope: "account-a" })
    ).resolves.toEqual([]);
    await accountB.push.disable({ endpoint });
    expect(ownedDevices.owners.get(endpoint)).toBe("account-a");
    expect(ownedDevices.enabled.get(endpoint)).toBe(true);
    await expect(
      accountA.push.deliveryHistory({ endpoint, cacheScope: "account-b" })
    ).resolves.toHaveLength(1);
    await accountA.push.disable({ endpoint });
    expect(ownedDevices.enabled.get(endpoint)).toBe(false);
    expect(upsertPushDevice).toHaveBeenCalledWith(subscription, "account-a");
    expect(reconcilePushDevice).toHaveBeenCalledWith(
      subscription,
      [],
      "account-a",
      undefined
    );
    expect(getPushDeliveryHistory).toHaveBeenCalledWith(endpoint, "account-b");
    expect(disablePushDevice).toHaveBeenCalledWith(endpoint, "account-b");
  });
});
