import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  duePushReminders: vi.fn(async () => []),
  claimPushReminder: vi.fn(),
  disablePushDeviceByEndpoint: vi.fn(),
  finalizePushReminderFailure: vi.fn(),
  markPushReminderSent: vi.fn(),
  isActivePushSchedule: vi.fn(),
  pushDeliveryStatusFromResponse: vi.fn(),
  recordPushDeliveryHistory: vi.fn(),
  sendWebPush: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest: mocks.authenticateRequest },
}));
vi.mock("./pushDb", () => ({
  claimPushReminder: mocks.claimPushReminder,
  disablePushDeviceByEndpoint: mocks.disablePushDeviceByEndpoint,
  duePushReminders: mocks.duePushReminders,
  finalizePushReminderFailure: mocks.finalizePushReminderFailure,
  isActivePushSchedule: mocks.isActivePushSchedule,
  markPushReminderSent: mocks.markPushReminderSent,
  pushDeliveryStatusFromResponse: mocks.pushDeliveryStatusFromResponse,
  recordPushDeliveryHistory: mocks.recordPushDeliveryHistory,
}));
vi.mock("./webPush", () => ({ sendWebPush: mocks.sendWebPush }));

import { dispatchScheduledPush } from "./pushSchedule";

function responseRecorder() {
  const state: { status?: number; body?: unknown } = {};
  const response = {
    status: vi.fn((status: number) => {
      state.status = status;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      state.body = body;
      return response;
    }),
  };
  return { response, state };
}

describe("scheduled push callback authorization", () => {
  it("rejects an unauthenticated request before querying due reminders", async () => {
    mocks.authenticateRequest.mockRejectedValueOnce(
      new Error("invalid session")
    );
    const { response, state } = responseRecorder();

    await dispatchScheduledPush({} as never, response as never);

    expect(state.status).toBe(401);
    expect(state.body).toEqual({
      error: "Scheduled push authentication failed.",
    });
    expect(mocks.duePushReminders).not.toHaveBeenCalled();
  });

  it("rejects an authenticated but unrelated scheduled task before delivery lookup", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({
      isCron: true,
      taskUid: "other-task",
    });
    mocks.isActivePushSchedule.mockResolvedValueOnce(false);
    const { response, state } = responseRecorder();

    await dispatchScheduledPush({} as never, response as never);

    expect(state.status).toBe(403);
    expect(state.body).toEqual({
      error: "Unrecognised scheduled push callback.",
    });
    expect(mocks.duePushReminders).not.toHaveBeenCalled();
  });

  it("allows only a persisted Heartbeat task to inspect the reminder queue", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({
      isCron: true,
      taskUid: "registered-task",
    });
    mocks.isActivePushSchedule.mockResolvedValueOnce(true);
    mocks.duePushReminders.mockResolvedValueOnce([]);
    const { response, state } = responseRecorder();

    await dispatchScheduledPush({} as never, response as never);

    expect(state.status).toBeUndefined();
    expect(state.body).toEqual({
      ok: true,
      inspected: 0,
      sent: 0,
      removed: 0,
      retired: 0,
    });
    expect(mocks.duePushReminders).toHaveBeenCalledTimes(1);
  });
});
