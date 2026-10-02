/* STUDENT OS — Scheduled reminder engine (browser side).
   Scans tasks and exams, fires system notifications for:
   - Tasks due today (every morning while app open)
   - Tasks due tomorrow (evening reminder)
   - Exams 7 days and 3 days before the exam date
   State is persisted in localStorage so firing once-per-day/milestone works
   across reloads. Re-arms every 60 seconds while the tab is visible. */

import { sendNotification } from "@/lib/browserNotif";
import type { StudyState } from "@/lib/types";
import { daysFromNow, todayStr } from "@/lib/utils";

const LS_KEY = "studentos:reminderSent";
type ReminderStorage = Pick<Storage, "getItem" | "setItem">;

interface ReminderLog {
  [key: string]: string; // key -> ISO day it last fired
}

export function reminderLogStorageKey(accountScope: string): string {
  return `${LS_KEY}:${encodeURIComponent(accountScope)}`;
}

function loadLog(accountScope: string, storage: ReminderStorage): ReminderLog {
  try {
    return JSON.parse(
      storage.getItem(reminderLogStorageKey(accountScope)) ?? "{}"
    );
  } catch {
    return {};
  }
}

function markSent(
  accountScope: string,
  key: string,
  day: string,
  storage: ReminderStorage
) {
  const log = loadLog(accountScope, storage);
  log[key] = day;
  storage.setItem(reminderLogStorageKey(accountScope), JSON.stringify(log));
}

/** Task due-today reminder key: fires once per calendar day. */
function taskKey(taskId: string, dueDay: string): string {
  return `task:${taskId}:${dueDay}`;
}

/** Exam milestone key: fires once ever per exam+daysLeft milestone. */
function examKey(examId: string, daysLeft: number): string {
  return `exam:${examId}:${daysLeft}`;
}

export function runReminders(
  state: StudyState,
  accountScope: string,
  storage: ReminderStorage = localStorage
): void {
  if (!state.settings?.notifications) return;
  const preferences = state.settings.notificationPreferences;
  const today = todayStr();
  const log = loadLog(accountScope, storage);

  /* ── Tasks ── */
  const profileName = state.profile?.name || "there";
  if (preferences.tasks)
    state.tasks
      .filter(t => t.status !== "completed" && t.dueDate)
      .forEach(t => {
        const days = daysFromNow(t.dueDate);
        if (days === 0) {
          const key = taskKey(t.id, today);
          if (log[key] !== today) {
            markSent(accountScope, key, today, storage);
            sendNotification(
              "📌 Task due today",
              `"${t.title}" is waiting — knock it out, ${profileName}!`
            );
          }
        } else if (days === 1) {
          const key = taskKey(t.id, t.dueDate);
          if (log[key] !== today) {
            markSent(accountScope, key, today, storage);
            sendNotification(
              "⏳ Task due tomorrow",
              `"${t.title}" is due tomorrow — plan a few minutes for it tonight.`
            );
          }
        }
      });

  /* ── Exams ── */
  if (preferences.exams)
    state.exams.forEach(e => {
      const days = daysFromNow(e.date);
      [7, 3, 1].forEach(m => {
        if (days === m) {
          const key = examKey(e.id, m);
          const fired = log[key];
          if (!fired) {
            markSent(accountScope, key, today, storage);
            const label =
              m === 7 ? "one week away" : m === 3 ? "in 3 days" : "tomorrow";
            sendNotification(
              "📚 Exam countdown",
              `"${e.subject}" is ${label} (${e.date}). Check the Exam Center!`
            );
          }
        }
      });
    });
}
