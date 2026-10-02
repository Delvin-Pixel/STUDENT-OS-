/* STUDENT OS — System (browser/push) notification helpers.
   Uses the native Notification API so reminders work even with the tab in the
   background. Gracefully degrades when unsupported or not permitted. */

export function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export type Permission = "granted" | "denied" | "default" | "unsupported";
export const PERMISSION_REQUEST_TIMEOUT_MS = 10_000;

export function permission(): Permission {
  if (!isSupported()) return "unsupported";
  return Notification.permission;
}

/** Request permission; resolves with the final permission state. */
export async function requestPermission(): Promise<Permission> {
  if (!isSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    let timer: number | undefined;
    const result = await Promise.race([
      Notification.requestPermission(),
      new Promise<Permission>(resolve => {
        timer = window.setTimeout(
          () => resolve(permission()),
          PERMISSION_REQUEST_TIMEOUT_MS
        );
      }),
    ]);
    if (timer) window.clearTimeout(timer);
    return result as Permission;
  } catch {
    return permission();
  }
}

/** Send a system notification. Returns true if actually shown. */
export function sendNotification(title: string, body: string): boolean {
  if (!isSupported() || Notification.permission !== "granted") return false;
  try {
    const n = new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: `studentos-${title}`, // coalesce duplicate messages
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
