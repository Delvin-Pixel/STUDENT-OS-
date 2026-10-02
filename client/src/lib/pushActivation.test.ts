import { describe, expect, it, vi } from "vitest";
import { activateAndVerifyPhonePush } from "./pushActivation";

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/device-a",
  p256dh: "p".repeat(24),
  auth: "a".repeat(12),
};

describe("phone push activation", () => {
  it("persists the device and reminders before asking the push service to accept the activation test", async () => {
    const order: string[] = [];
    const activate = vi.fn(async () => {
      order.push("activate");
      return { endpoint: subscription.endpoint, scheduled: 2 };
    });
    const sendTest = vi.fn(async () => {
      order.push("test");
      return { accepted: true };
    });

    await expect(
      activateAndVerifyPhonePush({
        subscription,
        reminders: [],
        activate,
        sendTest,
        rollback: vi.fn(async () => undefined),
      })
    ).resolves.toEqual({ endpoint: subscription.endpoint, scheduled: 2 });

    expect(order).toEqual(["activate", "test"]);
  });

  it("does not report activation when the push service rejects its test and disables the newly registered device", async () => {
    const rollback = vi.fn(async () => undefined);
    await expect(
      activateAndVerifyPhonePush({
        subscription,
        reminders: [],
        activate: vi.fn(async () => ({
          endpoint: subscription.endpoint,
          scheduled: 0,
        })),
        sendTest: vi.fn(async () => {
          throw new Error("Push service unavailable");
        }),
        rollback,
      })
    ).rejects.toThrow("Push service unavailable");

    expect(rollback).toHaveBeenCalledWith(subscription.endpoint);
  });

  it("does not send a test or claim activation when server persistence cannot verify the same subscription", async () => {
    const sendTest = vi.fn(async () => ({ accepted: true }));
    await expect(
      activateAndVerifyPhonePush({
        subscription,
        reminders: [],
        activate: vi.fn(async () => ({
          endpoint: "https://fcm.googleapis.com/fcm/send/other",
          scheduled: 0,
        })),
        sendTest,
        rollback: vi.fn(async () => undefined),
      })
    ).rejects.toThrow("could not verify");

    expect(sendTest).not.toHaveBeenCalled();
  });
});
