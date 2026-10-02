import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSupported,
  permission,
  PERMISSION_REQUEST_TIMEOUT_MS,
  requestPermission,
  sendNotification,
} from "./browserNotif";

class TestNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = vi.fn(
    async (): Promise<NotificationPermission> => {
      TestNotification.permission = "granted";
      return "granted";
    }
  );

  onclick: (() => void) | null = null;
  close = vi.fn();

  constructor(_title: string, _options?: NotificationOptions) {}
}

describe("browser notifications", () => {
  afterEach(() => {
    vi.useRealTimers();
    TestNotification.permission = "default";
    TestNotification.requestPermission.mockClear();
    vi.unstubAllGlobals();
  });

  it("requests permission and sends a notification once the browser grants it", async () => {
    vi.stubGlobal("window", { Notification: TestNotification });
    vi.stubGlobal("Notification", TestNotification);

    expect(isSupported()).toBe(true);
    expect(permission()).toBe("default");
    await expect(requestPermission()).resolves.toBe("granted");
    expect(TestNotification.requestPermission).toHaveBeenCalledOnce();
    expect(sendNotification("Study reminder", "Time to focus")).toBe(true);
  });

  it("reports unsupported contexts without leaving a disabled unexplained control", async () => {
    vi.stubGlobal("window", {});
    expect(isSupported()).toBe(false);
    await expect(requestPermission()).resolves.toBe("unsupported");
  });

  it("returns the current permission state when a native permission prompt never resolves", async () => {
    vi.useFakeTimers();
    TestNotification.requestPermission.mockImplementationOnce(
      () => new Promise(() => {})
    );
    vi.stubGlobal("window", {
      Notification: TestNotification,
      setTimeout,
      clearTimeout,
    });
    vi.stubGlobal("Notification", TestNotification);

    const result = requestPermission();
    await vi.advanceTimersByTimeAsync(PERMISSION_REQUEST_TIMEOUT_MS);

    await expect(result).resolves.toBe("default");
  });
});
