import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isActivePushSchedule: vi.fn() }));
vi.mock("./pushDb", () => ({
  isActivePushSchedule: mocks.isActivePushSchedule,
}));

import { isLivePushDispatchTask } from "./pushSchedule";

describe("scheduled push dispatcher guard", () => {
  it("accepts only an authenticated scheduled task present in the durable allowlist", async () => {
    mocks.isActivePushSchedule
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(
      isLivePushDispatchTask({ isCron: true, taskUid: "registered-task" })
    ).resolves.toBe(true);
    await expect(
      isLivePushDispatchTask({ isCron: false, taskUid: "registered-task" })
    ).resolves.toBe(false);
    await expect(
      isLivePushDispatchTask({ isCron: true, taskUid: "other-task" })
    ).resolves.toBe(false);
    expect(mocks.isActivePushSchedule).toHaveBeenCalledTimes(2);
  });
});
