import { useStore } from "@/contexts/StoreContext";
import {
  limitPlannedPushReminders,
  loadActiveFocusReminder,
  planDevicePushReminders,
  subscribeDevicePush,
} from "@/lib/devicePush";
import {
  devicePushSyncKey,
  lastRegisteredPushEndpoint,
  rememberRegisteredPushEndpoint,
} from "@/lib/pushSyncRecovery";
import { trpc } from "@/lib/trpc";
import { todayStr } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

/** Keeps the server-side reminder queue aligned with this installed device's local plan. */
export default function PushReminderSync() {
  const { state, accountCacheScope, workspaceReady } = useStore();
  const pushConfig = trpc.push.config.useQuery();
  const { mutateAsync: syncDeviceReminders } =
    trpc.push.syncReminders.useMutation();
  const { mutateAsync: disableDevice } = trpc.push.disable.useMutation();
  const completedSyncKey = useRef<string | null>(null);
  const notificationsEnabledRef = useRef(state.settings.notifications);
  notificationsEnabledRef.current = state.settings.notifications;
  const latestSyncJobRef = useRef<(() => Promise<void>) | null>(null);
  const requestedSyncVersionRef = useRef(0);
  const completedSyncVersionRef = useRef(0);
  const syncRunningRef = useRef(false);
  const runPendingSyncRef = useRef<() => void>(() => {});
  const [onlineEpoch, setOnlineEpoch] = useState(0);

  runPendingSyncRef.current = () => {
    if (syncRunningRef.current) return;
    syncRunningRef.current = true;
    void (async () => {
      try {
        while (
          completedSyncVersionRef.current < requestedSyncVersionRef.current
        ) {
          const syncVersion = requestedSyncVersionRef.current;
          try {
            await latestSyncJobRef.current?.();
          } catch (error) {
            console.warn("Student OS could not refresh phone reminders", error);
          } finally {
            completedSyncVersionRef.current = syncVersion;
          }
        }
      } finally {
        syncRunningRef.current = false;
        if (completedSyncVersionRef.current < requestedSyncVersionRef.current)
          runPendingSyncRef.current();
      }
    })();
  };
  const reminderFingerprint = useMemo(
    () =>
      JSON.stringify({
        tasks: state.tasks.map(({ id, title, dueDate, status }) => ({
          id,
          title,
          dueDate,
          status,
        })),
        exams: state.exams.map(({ id, subject, name, date }) => ({
          id,
          subject,
          name,
          date,
        })),
        savedLessons: state.savedLessons.map(({ id, savedAt }) => ({
          id,
          savedAt,
        })),
        streakDays: state.streakDays,
        lastActiveDay: state.lastActiveDay,
        longestStreak: state.longestStreak,
        dailyGoal: state.dailyGoal,
        customReminders: state.customReminders,
        todayLearning: {
          sessions: state.sessions
            .filter(
              session =>
                session.date === todayStr() && session.status === "completed"
            )
            .map(({ id, duration }) => ({ id, duration })),
          focus: state.focusSessions
            .filter(session => session.date === todayStr())
            .map(({ id, duration }) => ({ id, duration })),
        },
        preferences: state.settings.notificationPreferences,
      }),
    [
      state.tasks,
      state.exams,
      state.savedLessons,
      state.streakDays,
      state.lastActiveDay,
      state.longestStreak,
      state.dailyGoal,
      state.customReminders,
      state.sessions,
      state.focusSessions,
      state.settings.notificationPreferences,
    ]
  );

  useEffect(() => {
    const retryAfterReconnect = () => setOnlineEpoch(epoch => epoch + 1);
    window.addEventListener("online", retryAfterReconnect);
    return () => window.removeEventListener("online", retryAfterReconnect);
  }, []);

  useEffect(() => {
    if (!workspaceReady || !pushConfig.data?.configured) {
      latestSyncJobRef.current = null;
      requestedSyncVersionRef.current += 1;
      return;
    }
    if (!state.settings.notifications) {
      completedSyncKey.current = null;
      // Settings owns explicit device deactivation. Doing it here can race the
      // first user-triggered subscribe/register activation transaction.
      latestSyncJobRef.current = null;
      requestedSyncVersionRef.current += 1;
      return;
    }
    latestSyncJobRef.current = async () => {
      // The opaque browser endpoint identifies this installed Student OS copy.
      // Only synchronize once per meaningful local-plan change; mutation-state
      // renders must never cause an unbounded register/sync request loop.
      const subscription = await subscribeDevicePush(
        pushConfig.data.vapidPublicKey
      );
      const syncKey = devicePushSyncKey(
        subscription.endpoint,
        reminderFingerprint,
        onlineEpoch
      );
      if (completedSyncKey.current === syncKey) return;
      const previousEndpoint = lastRegisteredPushEndpoint(accountCacheScope);
      if (!notificationsEnabledRef.current) {
        await disableDevice({ endpoint: subscription.endpoint });
        return;
      }
      const focusReminder = state.settings.notificationPreferences.focus
        ? loadActiveFocusReminder(accountCacheScope)
        : null;
      const reminders = limitPlannedPushReminders(
        [
          ...planDevicePushReminders(state),
          ...(focusReminder ? [focusReminder] : []),
        ],
        state
      );
      await syncDeviceReminders({
        subscription,
        previousEndpoint:
          previousEndpoint && previousEndpoint !== subscription.endpoint
            ? previousEndpoint
            : undefined,
        reminders,
      });
      rememberRegisteredPushEndpoint(accountCacheScope, subscription.endpoint);
      completedSyncKey.current = syncKey;
    };
    requestedSyncVersionRef.current += 1;
    runPendingSyncRef.current();
    // `reminderFingerprint` intentionally restricts synchronization to relevant local planning fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    reminderFingerprint,
    onlineEpoch,
    accountCacheScope,
    state.settings.notifications,
    workspaceReady,
    pushConfig.data?.configured,
    pushConfig.data?.vapidPublicKey,
    syncDeviceReminders,
  ]);

  return null;
}
