import { getDailyGoalProgress } from "./dailyGoal";
import { SERVICE_WORKER_VERSION } from "./serviceWorkerVersion";
import type { StudyState } from "./types";

export type DevicePushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};
export type VibrationPattern = "off" | "gentle" | "standard" | "strong";
export type PlannedPushReminder = {
  dedupeKey: string;
  title: string;
  body: string;
  targetUrl: string;
  fireAt: Date;
  vibration?: number[];
};
type ReminderVibrationCategory =
  | "tasks"
  | "exams"
  | "focus"
  | "studyPlan"
  | "dailyGoal"
  | "streak"
  | "savedLessons"
  | "custom";
const ACTIVE_FOCUS_REMINDER_PREFIX = "studentos:active-focus-push:v2:";
const SERVICE_WORKER_READY_TIMEOUT_MS = 12_000;

export type DevicePushSupport = {
  supported: boolean;
  reason:
    | "ready"
    | "insecure-context"
    | "notification-api"
    | "service-worker"
    | "push-manager";
  message: string;
};

type PushCapabilitySnapshot = {
  secureContext: boolean;
  notification: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
};

export function activeFocusReminderKey(accountCacheScope: string) {
  return `${ACTIVE_FOCUS_REMINDER_PREFIX}${encodeURIComponent(accountCacheScope)}`;
}

const vibrationPatterns: Record<VibrationPattern, number[] | undefined> = {
  off: undefined,
  gentle: [80],
  standard: [150, 70, 150],
  strong: [240, 100, 240, 100, 240],
};

/** Returns a short, platform-safe vibration sequence for supported web push notifications. */
export function vibrationForPattern(pattern: VibrationPattern | undefined) {
  return vibrationPatterns[pattern ?? "standard"];
}

function vibrationCategoryForReminder(
  reminder: PlannedPushReminder
): ReminderVibrationCategory {
  if (reminder.dedupeKey.startsWith("task-")) return "tasks";
  if (reminder.dedupeKey.startsWith("exam-")) return "exams";
  if (reminder.dedupeKey.startsWith("study-plan-")) return "studyPlan";
  if (reminder.dedupeKey.startsWith("daily-goal-")) return "dailyGoal";
  if (reminder.dedupeKey.startsWith("streak-")) return "streak";
  if (reminder.dedupeKey.startsWith("saved-lesson-")) return "savedLessons";
  if (reminder.dedupeKey.startsWith("custom-")) return "custom";
  return "focus";
}

/** Keeps phone/HTTPS prerequisite copy deterministic and testable without a real browser. */
export function assessDevicePushSupport(
  capabilities: PushCapabilitySnapshot
): DevicePushSupport {
  if (!capabilities.secureContext) {
    return {
      supported: false,
      reason: "insecure-context",
      message:
        "Phone reminders require the published HTTPS Student OS site. Open it in a normal browser tab, not an embedded preview.",
    };
  }
  if (!capabilities.notification) {
    return {
      supported: false,
      reason: "notification-api",
      message:
        "This browser cannot display notifications. Use a current version of Chrome, Edge, Firefox, or Safari.",
    };
  }
  if (!capabilities.serviceWorker) {
    return {
      supported: false,
      reason: "service-worker",
      message:
        "This browser cannot install Student OS for reliable phone reminders. Open the published site in a supported browser.",
    };
  }
  if (!capabilities.pushManager) {
    return {
      supported: false,
      reason: "push-manager",
      message:
        "This browser does not support web-push subscriptions. Update your browser or use a supported mobile browser.",
    };
  }
  return {
    supported: true,
    reason: "ready",
    message: "This browser can register for phone reminders.",
  };
}

export function devicePushSupport(): DevicePushSupport {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      supported: false,
      reason: "service-worker",
      message:
        "Phone reminders can only be set up from a supported browser on your device.",
    };
  }
  return assessDevicePushSupport({
    secureContext: window.isSecureContext,
    notification: "Notification" in window,
    serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window,
  });
}

export function isDevicePushSupported() {
  return devicePushSupport().supported;
}

function base64UrlToUint8Array(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob(base64 + padding);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

function asBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer)
    throw new Error("The browser returned an incomplete push subscription.");
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function withTimeout<T>(
  operation: Promise<T>,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(message)),
          SERVICE_WORKER_READY_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Revalidates the root-scoped Student OS worker before asking PushManager for a subscription. */
async function readyStudentOsServiceWorker(): Promise<ServiceWorkerRegistration> {
  const support = devicePushSupport();
  if (!support.supported) throw new Error(support.message);
  const workerPath = `/api/service-worker-${SERVICE_WORKER_VERSION.replace("studentos-", "")}.js`;
  try {
    await navigator.serviceWorker.register(workerPath, {
      scope: "/",
      updateViaCache: "none",
    });
    const registration = await withTimeout(
      navigator.serviceWorker.ready,
      "Student OS could not finish preparing this device for push notifications. Refresh the published app and try again."
    );
    if (!registration.active) {
      throw new Error(
        "Student OS is still updating its notification service. Refresh the published app and try again."
      );
    }
    return registration;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(
      "Student OS could not prepare the notification service on this device. Refresh the published app and try again."
    );
  }
}

export async function subscribeDevicePush(
  vapidPublicKey: string
): Promise<DevicePushSubscription> {
  const support = devicePushSupport();
  if (!support.supported) throw new Error(support.message);
  if (Notification.permission !== "granted")
    throw new Error("Notification permission has not been granted.");
  if (!vapidPublicKey)
    throw new Error("Student OS push notifications are not configured yet.");

  const registration = await readyStudentOsServiceWorker();
  let subscription: PushSubscription;
  try {
    subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
      }));
  } catch (error) {
    if (error instanceof Error && error.name === "InvalidAccessError") {
      throw new Error(
        "This browser rejected the Student OS push key. Refresh the published app and try again."
      );
    }
    if (error instanceof Error && error.name === "NotAllowedError") {
      throw new Error(
        "This browser blocked the push subscription. Allow notifications for Student OS in site settings, then try again."
      );
    }
    if (error instanceof Error)
      throw new Error(
        `Student OS could not create a phone subscription: ${error.message}`
      );
    throw new Error(
      "Student OS could not create a phone subscription. Refresh the published app and try again."
    );
  }
  return {
    endpoint: subscription.endpoint,
    p256dh: asBase64Url(subscription.getKey("p256dh")),
    auth: asBase64Url(subscription.getKey("auth")),
  };
}

export async function currentDevicePushEndpoint() {
  if (!isDevicePushSupported()) return null;
  const registration = await readyStudentOsServiceWorker();
  return (await registration.pushManager.getSubscription())?.endpoint ?? null;
}

/** Read existing credentials without prompting for a new subscription. */
export async function currentDevicePushSubscription() {
  if (!isDevicePushSupported()) return null;
  const registration = await readyStudentOsServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  return {
    endpoint: subscription.endpoint,
    p256dh: asBase64Url(subscription.getKey("p256dh")),
    auth: asBase64Url(subscription.getKey("auth")),
  };
}

export async function unsubscribeDevicePush() {
  if (!isDevicePushSupported()) return;
  const registration = await readyStudentOsServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  await subscription?.unsubscribe();
}

/** Plans a phone reminder for an active focus block, so it can arrive after the app closes. */
export function planFocusCompletionReminder(
  secondsLeft: number,
  subject: string,
  now = new Date(),
  vibrationPattern: VibrationPattern = "standard"
): PlannedPushReminder | null {
  if (!Number.isFinite(secondsLeft) || secondsLeft <= 0) return null;
  const fireAt = new Date(now.getTime() + secondsLeft * 1000);
  return {
    dedupeKey: `focus-${Math.floor(fireAt.getTime() / 1000)}`,
    title: "Student OS · Focus session complete",
    body: subject
      ? `Your ${subject} focus block is complete. Take a well-earned break.`
      : "Your focus block is complete. Take a well-earned break.",
    targetUrl: "/focus",
    fireAt,
    vibration: vibrationForPattern(vibrationPattern),
  };
}

export function saveActiveFocusReminder(
  accountCacheScope: string,
  reminder: PlannedPushReminder | null
) {
  if (typeof window === "undefined") return;
  try {
    const key = activeFocusReminderKey(accountCacheScope);
    if (!reminder) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(
      key,
      JSON.stringify({ ...reminder, fireAt: reminder.fireAt.toISOString() })
    );
  } catch {
    // Timer progress remains usable when a privacy setting blocks local storage.
  }
}

export function loadActiveFocusReminder(
  accountCacheScope: string,
  now = new Date()
): PlannedPushReminder | null {
  if (typeof window === "undefined") return null;
  try {
    const key = activeFocusReminderKey(accountCacheScope);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Omit<PlannedPushReminder, "fireAt"> & {
      fireAt: string;
    };
    const fireAt = new Date(stored.fireAt);
    if (Number.isNaN(fireAt.getTime()) || fireAt <= now) {
      window.localStorage.removeItem(key);
      return null;
    }
    return { ...stored, fireAt };
  } catch {
    return null;
  }
}

function dateAtLocalMorning(dateKey: string) {
  return new Date(`${dateKey}T08:00:00`);
}

function dateAtLocalTime(dateKey: string, time: string) {
  return new Date(
    `${dateKey}T${/^\d{2}:\d{2}$/.test(time) ? time : "08:00"}:00`
  );
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isDuringQuietHours(date: Date, start: string, end: string) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return Number.isFinite(hour) && Number.isFinite(minute)
      ? hour * 60 + minute
      : 0;
  };
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  return startMinutes === endMinutes
    ? false
    : startMinutes < endMinutes
      ? minutes >= startMinutes && minutes < endMinutes
      : minutes >= startMinutes || minutes < endMinutes;
}

/** Apply quiet hours and daily maximums after all learning categories are planned. */
export function limitPlannedPushReminders(
  reminders: PlannedPushReminder[],
  state: StudyState
): PlannedPushReminder[] {
  const preferences = state.settings.notificationPreferences;
  const capped = new Map<string, number>();
  return reminders
    .filter(
      reminder =>
        !preferences.quietHours.enabled ||
        !isDuringQuietHours(
          reminder.fireAt,
          preferences.quietHours.start,
          preferences.quietHours.end
        )
    )
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
    .filter(reminder => {
      const day = localDateKey(reminder.fireAt);
      const used = capped.get(day) ?? 0;
      if (used >= preferences.dailyCap) return false;
      capped.set(day, used + 1);
      return true;
    })
    .slice(0, 40);
}

/** Translates local task/exam data into idempotent server-side phone reminders. */
export function planDevicePushReminders(
  state: StudyState,
  now = new Date()
): PlannedPushReminder[] {
  const reminders: PlannedPushReminder[] = [];
  const preferences = state.settings.notificationPreferences;
  const add = (reminder: PlannedPushReminder) => {
    if (reminder.fireAt.getTime() > now.getTime()) {
      const category = vibrationCategoryForReminder(reminder);
      reminders.push({
        ...reminder,
        vibration: vibrationForPattern(
          preferences.categoryVibrationPatterns?.[category] ??
            preferences.vibrationPattern
        ),
      });
    }
  };

  if (preferences.tasks)
    state.tasks
      .filter(task => task.status !== "completed" && Boolean(task.dueDate))
      .forEach(task => {
        const due = dateAtLocalMorning(task.dueDate);
        if (Number.isNaN(due.getTime())) return;
        add({
          dedupeKey: `task-${task.id}-${task.dueDate}`,
          title: "Student OS · Task due",
          body: "You have a task due today. A focused 10-minute start can make it easier.",
          targetUrl: "/tasks",
          fireAt: due,
        });
      });

  if (preferences.exams)
    state.exams.forEach(exam => {
      const examMorning = dateAtLocalMorning(exam.date);
      if (Number.isNaN(examMorning.getTime())) return;
      [7, 3, 1].forEach(daysBefore => {
        const fireAt = new Date(
          examMorning.getTime() - daysBefore * 86_400_000
        );
        add({
          dedupeKey: `exam-${exam.id}-${daysBefore}`,
          title: "Student OS · Exam reminder",
          body: `An exam is in ${daysBefore} day${daysBefore === 1 ? "" : "s"}. Plan one revision block today.`,
          targetUrl: "/exams",
          fireAt,
        });
      });
    });

  const today = localDateKey(now);
  if (preferences.studyPlan && state.profile) {
    for (let offset = 0; offset < 14; offset += 1) {
      const day = new Date(now);
      day.setDate(now.getDate() + offset);
      const key = localDateKey(day);
      const fireAt = dateAtLocalTime(key, preferences.studyPlanTime);
      add({
        dedupeKey: `study-plan-${key}`,
        title: "Student OS · Study plan",
        body: "Set up your next focused study block and make a little progress today.",
        targetUrl: "/study",
        fireAt,
      });
    }
  }
  if (preferences.dailyGoal && state.profile) {
    for (let offset = 0; offset < 14; offset += 1) {
      const day = new Date(now);
      day.setDate(now.getDate() + offset);
      const key = localDateKey(day);
      // Do not nudge a student about today's target once it has been reached.
      if (offset === 0 && getDailyGoalProgress(state, key).complete) continue;
      add({
        dedupeKey: `daily-goal-${key}`,
        title: "Student OS · Daily learning goal",
        body: `A short study block can move you toward today's ${state.dailyGoal.targetMinutes}-minute learning goal.`,
        targetUrl: "/",
        fireAt: dateAtLocalTime(key, preferences.dailyGoalTime),
      });
    }
  }
  if (
    preferences.streak &&
    state.streakDays > 0 &&
    state.lastActiveDay !== today
  ) {
    const fireAt = dateAtLocalTime(today, "19:00");
    add({
      dedupeKey: `streak-${today}`,
      title: "Student OS · Keep your streak going",
      body: "A short focused session today keeps your learning streak moving.",
      targetUrl: "/focus",
      fireAt,
    });
  }
  if (
    preferences.streak &&
    state.streakDays >= 3 &&
    state.lastActiveDay === today
  ) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const key = localDateKey(tomorrow);
    add({
      dedupeKey: `streak-celebration-${today}`,
      title: "Student OS · Streak milestone",
      body: `Great work yesterday — your ${state.streakDays}-day learning streak is growing.`,
      targetUrl: "/progress",
      fireAt: dateAtLocalTime(key, "09:00"),
    });
  }
  if (preferences.savedLessons && state.savedLessons.length) {
    const fireAt = dateAtLocalTime(today, "18:30");
    add({
      dedupeKey: `saved-lesson-review-${today}`,
      title: "Student OS · Quick review",
      body: "A few minutes reviewing a saved lesson can strengthen recall.",
      targetUrl: "/saved",
      fireAt,
    });
  }

  state.customReminders
    .filter(reminder => reminder.enabled)
    .forEach(reminder => {
      const scheduleDay = (dateKey: string) =>
        add({
          dedupeKey: `custom-${reminder.id}-${dateKey}`,
          title: `Student OS · ${reminder.title}`,
          body: reminder.message,
          targetUrl: "/settings",
          fireAt: dateAtLocalTime(dateKey, reminder.time),
        });
      if (reminder.repeat === "daily") {
        for (let offset = 0; offset < 14; offset += 1) {
          const day = new Date(now);
          day.setDate(now.getDate() + offset);
          scheduleDay(localDateKey(day));
        }
        return;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(reminder.date)) scheduleDay(reminder.date);
    });

  return limitPlannedPushReminders(reminders, state);
}
