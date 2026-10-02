import { SERVICE_WORKER_VERSION } from "./serviceWorkerVersion";

export type DeviceDiagnostics = {
  secureContext: boolean;
  online: boolean;
  standalone: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerController: boolean;
  serviceWorkerVersion: string;
  pushSupported: boolean;
  notificationsSupported: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  pushSubscriptionPresent: boolean | null;
};

export async function collectDeviceDiagnostics(): Promise<DeviceDiagnostics> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      secureContext: false,
      online: false,
      standalone: false,
      serviceWorkerSupported: false,
      serviceWorkerController: false,
      serviceWorkerVersion: SERVICE_WORKER_VERSION,
      pushSupported: false,
      notificationsSupported: false,
      notificationPermission: "unsupported",
      pushSubscriptionPresent: null,
    };
  }

  const serviceWorkerSupported = "serviceWorker" in navigator;
  let pushSubscriptionPresent: boolean | null = null;
  if (serviceWorkerSupported && "PushManager" in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      pushSubscriptionPresent = Boolean(
        await registration.pushManager.getSubscription()
      );
    } catch {
      pushSubscriptionPresent = null;
    }
  }

  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return {
    secureContext: window.isSecureContext,
    online: navigator.onLine,
    standalone,
    serviceWorkerSupported,
    serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
    serviceWorkerVersion: SERVICE_WORKER_VERSION,
    pushSupported: "PushManager" in window,
    notificationsSupported: "Notification" in window,
    notificationPermission:
      "Notification" in window ? Notification.permission : "unsupported",
    pushSubscriptionPresent,
  };
}
