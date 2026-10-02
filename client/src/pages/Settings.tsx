/* STUDENT OS — Settings. Profile, data export/import, theme, reset. All
   data is local-only; no accounts, no cloud. */

import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/contexts/StoreContext";
import {
  academicSelectionKindFor,
  academicSelectionLabelFor,
} from "@/lib/academicOfferings";
import {
  permission as notifPermission,
  requestPermission,
} from "@/lib/browserNotif";
import {
  currentDevicePushEndpoint,
  devicePushSupport,
  isDevicePushSupported,
  planDevicePushReminders,
  subscribeDevicePush,
  unsubscribeDevicePush,
  vibrationForPattern,
} from "@/lib/devicePush";
import { activateAndVerifyPhonePush } from "@/lib/pushActivation";
import { phoneTestErrorMessage } from "@/lib/pushTestErrors";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Bell,
  Download,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function localCalendarDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Settings() {
  const { state } = useStore();
  const profile = state.profile;
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Settings
        </h1>
        <section className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold">
            Set up your Student OS first
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Tell us your name, learning level, goals, and subjects. Then you can
            personalise your settings, reminders, and backup options.
          </p>
          <Button
            variant="sunrise"
            className="mt-5"
            onClick={() => window.location.assign("/")}
          >
            Start setup <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </section>
      </div>
    );
  }
  return <SettingsForm profile={profile} />;
}

function SettingsForm({
  profile,
}: {
  profile: NonNullable<ReturnType<typeof useStore>["state"]["profile"]>;
}) {
  const {
    state,
    setProfile,
    exportState,
    importState,
    resetState,
    deleteWorkspaceEverywhere,
    restartOnboarding,
    notify,
    setNotificationsEnabled,
    setNotificationPreferences,
    setDailyGoalTarget,
    addCustomReminder,
    updateCustomReminder,
    deleteCustomReminder,
  } = useStore();
  const { user } = useAuth();

  const [name, setName] = useState(profile.name);
  const [hours, setHours] = useState(profile.hoursPerDay);
  const [subjectsInput, setSubjectsInput] = useState(
    profile.subjects.join(", ")
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const pushSupport = devicePushSupport();
  const notifSupported = pushSupport.supported;
  const [notifState, setNotifState] = useState<string>("unknown");
  const [permissionAttempted, setPermissionAttempted] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderTime, setReminderTime] = useState("18:00");
  const [reminderDate, setReminderDate] = useState(localCalendarDate);
  const [reminderRepeat, setReminderRepeat] = useState<"once" | "daily">(
    "once"
  );
  const [editingReminderId, setEditingReminderId] = useState<string | null>(
    null
  );
  const customReminderSaveClaimRef = useRef(false);
  const notificationToggleVersionRef = useRef(0);
  const notificationDesiredRef = useRef(state.settings.notifications);
  const pushConfig = trpc.push.config.useQuery();
  const activatePush = trpc.push.activate.useMutation();
  const disablePush = trpc.push.disable.useMutation();
  const testPushDelivery = trpc.push.testDelivery.useMutation();
  const [pushEndpoint, setPushEndpoint] = useState<string | null>(null);
  const [pushSetupError, setPushSetupError] = useState<string | null>(null);
  const phoneSetupPending =
    activatePush.isPending ||
    testPushDelivery.isPending ||
    disablePush.isPending;
  const deliveryHistoryInput = useMemo(
    () => ({
      endpoint: pushEndpoint ?? "https://not-registered.studentos.invalid",
      cacheScope: user?.openId ?? "unknown-account",
    }),
    [pushEndpoint, user?.openId]
  );
  const deliveryHistory = trpc.push.deliveryHistory.useQuery(
    deliveryHistoryInput,
    {
      enabled:
        Boolean(pushEndpoint) &&
        state.settings.notifications &&
        notifState === "granted",
      refetchInterval: 60_000,
    }
  );

  useEffect(() => {
    if (!state.settings.notifications || notifState !== "granted") {
      setPushEndpoint(null);
      return;
    }
    let active = true;
    void currentDevicePushEndpoint().then(endpoint => {
      if (active) setPushEndpoint(endpoint);
    });
    return () => {
      active = false;
    };
  }, [state.settings.notifications, notifState]);

  const sendRealPhoneTest = async () => {
    try {
      const endpoint = await currentDevicePushEndpoint();
      if (!endpoint)
        throw new Error(
          "This phone is not registered yet. Turn phone reminders off and on again."
        );
      await testPushDelivery.mutateAsync({
        endpoint,
        vibration: vibrationForPattern(
          state.settings.notificationPreferences.vibrationPattern
        ),
      });
      setPushEndpoint(endpoint);
      await deliveryHistory.refetch();
      toast.success(
        "“We’ve got u on check” was accepted by the push service. Check your notification shade or lock screen."
      );
    } catch (error) {
      const message = phoneTestErrorMessage(error);
      setPushSetupError(message);
      toast.error(message);
    }
  };

  // keep local permission state in sync (iOS/Safari can change it outside the app)
  useEffect(() => {
    setNotifState(notifPermission());
    const id = window.setInterval(() => setNotifState(notifPermission()), 2000);
    return () => window.clearInterval(id);
  }, []);

  const saveProfile = () => {
    const subjects = subjectsInput
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    setProfile({
      name: name.trim() || profile.name,
      hoursPerDay: hours,
      subjects,
      academicSelectionKind: academicSelectionKindFor(profile.educationLevel),
    });
    notify("Profile saved.", "success");
  };

  const doExport = () => {
    const data = exportState();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `student-os-backup-${localCalendarDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded.");
  };

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await importState(String(reader.result));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const refreshDeviceCache = async () => {
    const refreshed = await resetState();
    if (refreshed)
      toast.success(
        "This device cache was refreshed from your private cloud workspace."
      );
    else
      toast.error(
        "Student OS could not refresh this device cache. Connect to the internet and try again."
      );
  };

  const deleteEverywhere = async () => {
    const cleared = await deleteWorkspaceEverywhere();
    if (cleared)
      toast.success("Your cloud workspace and this device cache were deleted.");
    else
      toast.error(
        "Student OS could not delete your cloud workspace. Nothing was removed; please try again."
      );
  };

  const clearCustomReminderForm = () => {
    setReminderTitle("");
    setReminderMessage("");
    setReminderTime("18:00");
    setReminderDate(localCalendarDate());
    setReminderRepeat("once");
    setEditingReminderId(null);
  };

  useEffect(() => {
    if (reminderTitle || reminderMessage)
      customReminderSaveClaimRef.current = false;
  }, [
    reminderDate,
    reminderMessage,
    reminderRepeat,
    reminderTime,
    reminderTitle,
  ]);

  const saveCustomReminder = () => {
    const reminder = {
      title: reminderTitle,
      message: reminderMessage,
      time: reminderTime,
      date: reminderRepeat === "daily" ? "" : reminderDate,
      repeat: reminderRepeat,
      enabled: true,
    } as const;
    if (editingReminderId) {
      if (updateCustomReminder(editingReminderId, reminder)) {
        toast.success("Custom reminder updated.");
        clearCustomReminderForm();
      }
      return;
    }
    if (customReminderSaveClaimRef.current) return;
    customReminderSaveClaimRef.current = true;
    if (addCustomReminder(reminder)) clearCustomReminderForm();
    else customReminderSaveClaimRef.current = false;
  };

  const editCustomReminder = (
    reminder: (typeof state.customReminders)[number]
  ) => {
    setEditingReminderId(reminder.id);
    setReminderTitle(reminder.title);
    setReminderMessage(reminder.message);
    setReminderTime(reminder.time);
    setReminderDate(reminder.date || localCalendarDate());
    setReminderRepeat(reminder.repeat);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Settings
      </h1>

      <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Profile</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Student type
            </Label>
            <Select
              value={profile.studentType}
              onValueChange={v =>
                setProfile({ studentType: v as typeof profile.studentType })
              }
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Secondary School">
                  Secondary School
                </SelectItem>
                <SelectItem value="University">University</SelectItem>
                <SelectItem value="College">College</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-semibold">
              {academicSelectionLabelFor(profile.educationLevel) === "course"
                ? "Courses"
                : "Subjects"}{" "}
              (comma-separated)
            </Label>
            <Input
              value={subjectsInput}
              onChange={e => setSubjectsInput(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Hours per day
            </Label>
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["30 minutes", "1 hour", "2 hours", "3 hours", "4+ hours"].map(
                  h => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="sunrise" onClick={saveProfile}>
          Save profile
        </Button>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Reminders</h2>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Choose the reminders that support your learning. Phone alerts are
          private, grouped to avoid repetition, and delivered even when the
          installed Student OS app is closed.
        </p>
        <div
          className={`mt-3 rounded-xl border p-3 text-xs ${pushSetupError ? "border-destructive/30 bg-destructive/5 text-destructive" : state.settings.notifications ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200" : "border-border/70 bg-muted/40 text-muted-foreground"}`}
          role="status"
        >
          {pushSetupError
            ? pushSetupError
            : state.settings.notifications
              ? "Phone reminders are registered on this browser. Student OS records when the push service accepts each attempt; your phone controls whether alerts are visibly shown."
              : "Phone reminders are off. Turn them on here to grant permission, register this browser, schedule your first reminders, and verify the connection with “We’ve got u on check”."}
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch
              id="notif-toggle"
              checked={state.settings.notifications}
              disabled={phoneSetupPending}
              onCheckedChange={async on => {
                const toggleVersion = ++notificationToggleVersionRef.current;
                notificationDesiredRef.current = on;
                const isCurrentToggle = () =>
                  notificationToggleVersionRef.current === toggleVersion;
                if (!notifSupported) {
                  setNotificationsEnabled(false);
                  setPushSetupError(pushSupport.message);
                  toast.error(pushSupport.message);
                  return;
                }
                if (on) {
                  setPushSetupError(null);
                  setPermissionAttempted(true);
                  const p = await requestPermission();
                  setNotifState(p);
                  if (!isCurrentToggle()) return;
                  if (p === "granted") {
                    if (!isDevicePushSupported()) {
                      setNotificationsEnabled(false);
                      setPushSetupError(pushSupport.message);
                      toast.error(pushSupport.message);
                      return;
                    }
                    if (!pushConfig.data?.configured) {
                      const message = pushConfig.isError
                        ? "Student OS could not verify its push configuration. Check your connection, refresh the published app, and try again."
                        : "Student OS phone reminders are not configured on the server yet. Please try again after the app is updated.";
                      setNotificationsEnabled(false);
                      setPushSetupError(message);
                      toast.error(message);
                      return;
                    }
                    try {
                      const subscription = await subscribeDevicePush(
                        pushConfig.data.vapidPublicKey
                      );
                      if (!isCurrentToggle()) {
                        if (!notificationDesiredRef.current)
                          await unsubscribeDevicePush();
                        return;
                      }
                      const plannedReminders = planDevicePushReminders(state);
                      const activation = await activateAndVerifyPhonePush({
                        subscription,
                        reminders: plannedReminders,
                        vibration: vibrationForPattern(
                          state.settings.notificationPreferences
                            .vibrationPattern
                        ),
                        activate: input => activatePush.mutateAsync(input),
                        sendTest: input => testPushDelivery.mutateAsync(input),
                        rollback: async endpoint => {
                          await disablePush.mutateAsync({ endpoint });
                        },
                      });
                      if (!isCurrentToggle()) {
                        if (!notificationDesiredRef.current) {
                          await disablePush.mutateAsync({
                            endpoint: activation.endpoint,
                          });
                          await unsubscribeDevicePush();
                        }
                        return;
                      }
                      setPushEndpoint(activation.endpoint);
                      setNotificationsEnabled(true);
                      setPushSetupError(null);
                      await deliveryHistory.refetch();
                      if (activation.scheduled)
                        toast.success(
                          `“We’ve got u on check” was accepted by the push service. ${activation.scheduled} upcoming reminder${activation.scheduled === 1 ? "" : "s"} scheduled.`
                        );
                      else
                        toast.success(
                          "“We’ve got u on check” was accepted by the push service. Add a future task, exam, focus block, or custom reminder to schedule another alert."
                        );
                    } catch (error) {
                      if (!isCurrentToggle()) return;
                      const message =
                        error instanceof Error
                          ? error.message
                          : "Student OS could not set up device notifications. Check your connection, refresh the published app, and try again.";
                      setNotificationsEnabled(false);
                      setPushSetupError(message);
                      toast.error(message);
                    }
                  } else {
                    const message =
                      p === "denied"
                        ? "Notifications are blocked for this site — allow them in your browser's site settings, then try again."
                        : "Notification permission was not granted. If no prompt appeared, open the published site in a normal browser tab and try again.";
                    setPushSetupError(message);
                    toast.error(message);
                    setNotificationsEnabled(false);
                  }
                } else {
                  setPermissionAttempted(false);
                  setPushSetupError(null);
                  try {
                    const endpoint = await currentDevicePushEndpoint();
                    if (!isCurrentToggle()) return;
                    if (endpoint) await disablePush.mutateAsync({ endpoint });
                    if (!isCurrentToggle()) return;
                    await unsubscribeDevicePush();
                  } finally {
                    if (isCurrentToggle()) {
                      setNotificationsEnabled(false);
                      toast.info("Device reminders turned off.");
                    }
                  }
                }
              }}
            />
            <Label htmlFor="notif-toggle" className="text-sm">
              Phone push reminders
            </Label>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-muted/50 p-3">
          <Label htmlFor="vibration-pattern" className="text-xs font-semibold">
            Default notification vibration
          </Label>
          <Select
            value={state.settings.notificationPreferences.vibrationPattern}
            onValueChange={value =>
              setNotificationPreferences({
                vibrationPattern: value as
                  "off" | "gentle" | "standard" | "strong",
              })
            }
          >
            <SelectTrigger id="vibration-pattern" className="mt-2 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">No vibration</SelectItem>
              <SelectItem value="gentle">Gentle pulse</SelectItem>
              <SelectItem value="standard">Standard pattern</SelectItem>
              <SelectItem value="strong">Strong pattern</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            This is the fallback for future reminder types. Choose individual
            patterns below where you want a different feel. Vibration is used
            only where your installed browser and phone support it. Notification
            sounds are selected in your phone’s app or site notification
            settings; web apps cannot reliably choose a custom sound.
          </p>
        </div>
        {notifState === "denied" && (
          <p className="mt-3 text-xs text-destructive">
            Notifications are blocked by your browser. Allow notifications for
            this site in browser settings, then return here to enable reminders.
          </p>
        )}
        {permissionAttempted && notifState === "default" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Your browser has not granted permission yet. If no permission prompt
            appeared, an embedded preview may be blocking it. Open the published
            Student OS site in a normal Chrome, Edge, Firefox, or Safari tab,
            then switch reminders on again.
          </p>
        )}
        {state.settings.notifications && notifState === "granted" && (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["tasks", "Task deadlines"],
                ["exams", "Exam preparation"],
                ["focus", "Focus session completion"],
                ["studyPlan", "Daily study plan"],
                ["dailyGoal", "Daily learning goal"],
                ["streak", "Learning streak"],
                ["savedLessons", "Saved lesson review"],
                ["custom", "Custom notifications"],
              ].map(([key, label]) => (
                <div
                  key={key}
                  className="rounded-xl border border-border/70 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`reminder-${key}`} className="text-sm">
                      {label}
                    </Label>
                    {key !== "custom" && (
                      <Switch
                        id={`reminder-${key}`}
                        checked={
                          state.settings.notificationPreferences[
                            key as keyof typeof state.settings.notificationPreferences
                          ] as boolean
                        }
                        onCheckedChange={checked =>
                          setNotificationPreferences({ [key]: checked })
                        }
                      />
                    )}
                  </div>
                  <Select
                    value={
                      state.settings.notificationPreferences
                        .categoryVibrationPatterns?.[
                        key as keyof typeof state.settings.notificationPreferences.categoryVibrationPatterns
                      ] ?? "default"
                    }
                    onValueChange={value => {
                      const categoryVibrationPatterns = {
                        ...state.settings.notificationPreferences
                          .categoryVibrationPatterns,
                      };
                      if (value === "default")
                        delete categoryVibrationPatterns[
                          key as keyof typeof categoryVibrationPatterns
                        ];
                      else
                        categoryVibrationPatterns[
                          key as keyof typeof categoryVibrationPatterns
                        ] = value as "off" | "gentle" | "standard" | "strong";
                      setNotificationPreferences({ categoryVibrationPatterns });
                    }}
                  >
                    <SelectTrigger className="mt-3 h-9 rounded-lg text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        Use default pattern
                      </SelectItem>
                      <SelectItem value="off">No vibration</SelectItem>
                      <SelectItem value="gentle">Gentle pulse</SelectItem>
                      <SelectItem value="standard">Standard pattern</SelectItem>
                      <SelectItem value="strong">Strong pattern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-border/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="quiet-hours" className="text-sm">
                    Quiet hours
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Student OS holds non-urgent learning nudges during this
                    window.
                  </p>
                </div>
                <Switch
                  id="quiet-hours"
                  checked={
                    state.settings.notificationPreferences.quietHours.enabled
                  }
                  onCheckedChange={enabled =>
                    setNotificationPreferences({
                      quietHours: {
                        ...state.settings.notificationPreferences.quietHours,
                        enabled,
                      },
                    })
                  }
                />
              </div>
              {state.settings.notificationPreferences.quietHours.enabled && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1 block text-xs">Starts</Label>
                    <Input
                      type="time"
                      value={
                        state.settings.notificationPreferences.quietHours.start
                      }
                      onChange={event =>
                        setNotificationPreferences({
                          quietHours: {
                            ...state.settings.notificationPreferences
                              .quietHours,
                            start: event.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">Ends</Label>
                    <Input
                      type="time"
                      value={
                        state.settings.notificationPreferences.quietHours.end
                      }
                      onChange={event =>
                        setNotificationPreferences({
                          quietHours: {
                            ...state.settings.notificationPreferences
                              .quietHours,
                            end: event.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="mb-1 block text-xs">
                  Maximum reminders per day
                </Label>
                <Select
                  value={String(
                    state.settings.notificationPreferences.dailyCap
                  )}
                  onValueChange={value =>
                    setNotificationPreferences({ dailyCap: Number(value) })
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(count => (
                      <SelectItem key={count} value={String(count)}>
                        {count} per day
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">
                  Study plan reminder
                </Label>
                <Input
                  type="time"
                  value={state.settings.notificationPreferences.studyPlanTime}
                  onChange={event =>
                    setNotificationPreferences({
                      studyPlanTime: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">
                  Daily-goal reminder
                </Label>
                <Input
                  type="time"
                  value={state.settings.notificationPreferences.dailyGoalTime}
                  onChange={event =>
                    setNotificationPreferences({
                      dailyGoalTime: event.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border/70 p-3">
              <Label htmlFor="daily-goal-target" className="text-sm">
                Daily learning goal
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Completed study sessions and Focus blocks count toward this
                private target.
              </p>
              <Select
                value={String(state.dailyGoal.targetMinutes)}
                onValueChange={value => setDailyGoalTarget(Number(value))}
              >
                <SelectTrigger
                  id="daily-goal-target"
                  className="mt-3 rounded-xl"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90, 120, 180].map(minutes => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {minutes} minutes a day
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 rounded-xl border border-border/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-sm">Custom notifications</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create up to three private reminders in your own words. They
                    still follow quiet hours and your daily limit.
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {state.customReminders.length}/3
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label="Custom reminder title"
                  maxLength={70}
                  placeholder="Title, e.g. Review notes"
                  value={reminderTitle}
                  onChange={event => setReminderTitle(event.target.value)}
                />
                <Input
                  aria-label="Custom reminder message"
                  maxLength={180}
                  placeholder="Encouraging message"
                  value={reminderMessage}
                  onChange={event => setReminderMessage(event.target.value)}
                />
                <Select
                  value={reminderRepeat}
                  onValueChange={value =>
                    setReminderRepeat(value as "once" | "daily")
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One time</SelectItem>
                    <SelectItem value="daily">Every day</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  aria-label="Custom reminder time"
                  type="time"
                  value={reminderTime}
                  onChange={event => setReminderTime(event.target.value)}
                />
                {reminderRepeat === "once" && (
                  <Input
                    aria-label="Custom reminder date"
                    type="date"
                    min={localCalendarDate()}
                    value={reminderDate}
                    onChange={event => setReminderDate(event.target.value)}
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={saveCustomReminder}
                  disabled={
                    !reminderTitle.trim() ||
                    !reminderMessage.trim() ||
                    (!editingReminderId && state.customReminders.length >= 3)
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {editingReminderId ? "Save changes" : "Add reminder"}
                </Button>
                {editingReminderId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={clearCustomReminderForm}
                  >
                    Cancel
                  </Button>
                )}
              </div>
              {state.customReminders.length > 0 && (
                <div className="mt-4 space-y-2">
                  {state.customReminders.map(reminder => (
                    <div
                      key={reminder.id}
                      className="flex items-center gap-2 rounded-lg bg-muted/45 p-2.5"
                    >
                      <Switch
                        aria-label={`Enable ${reminder.title}`}
                        checked={reminder.enabled}
                        onCheckedChange={enabled =>
                          updateCustomReminder(reminder.id, { enabled })
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {reminder.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {reminder.message} ·{" "}
                          {reminder.repeat === "daily"
                            ? `Daily at ${reminder.time}`
                            : `${reminder.date} at ${reminder.time}`}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Edit ${reminder.title}`}
                        onClick={() => editCustomReminder(reminder)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        aria-label={`Delete ${reminder.title}`}
                        onClick={() => {
                          deleteCustomReminder(reminder.id);
                          if (editingReminderId === reminder.id)
                            clearCustomReminderForm();
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              className="mt-4 rounded-full bg-card"
              disabled={phoneSetupPending}
              onClick={() => void sendRealPhoneTest()}
            >
              {testPushDelivery.isPending
                ? "Sending phone test…"
                : "Send a real phone test"}
            </Button>
            <div className="mt-5 rounded-xl border border-border/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-sm">
                    Notification delivery history
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Shows whether Student OS was accepted by the phone push
                    service. It cannot reveal whether you saw a lock-screen
                    alert.
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                  Last 30
                </span>
              </div>
              {deliveryHistory.isLoading && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Loading delivery history…
                </p>
              )}
              {deliveryHistory.isError && (
                <p className="mt-3 text-xs text-destructive">
                  Delivery history is temporarily unavailable. Your reminders
                  can still be scheduled.
                </p>
              )}
              {!deliveryHistory.isLoading &&
                !deliveryHistory.isError &&
                (!deliveryHistory.data ||
                  deliveryHistory.data.length === 0) && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No phone-delivery attempts yet. Use “Send a real phone test”
                    to confirm this device.
                  </p>
                )}
              {deliveryHistory.data && deliveryHistory.data.length > 0 && (
                <div className="mt-3 space-y-2">
                  {deliveryHistory.data.map((entry, index) => {
                    const statusCopy =
                      entry.status === "accepted"
                        ? "Accepted by push service"
                        : entry.status === "expired"
                          ? "Subscription expired"
                          : "Delivery attempt failed";
                    const statusClass =
                      entry.status === "accepted"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : entry.status === "expired"
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-destructive";
                    return (
                      <div
                        key={`${entry.createdAt.toString()}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/45 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium">
                            {entry.kind === "test"
                              ? "Phone test"
                              : "Scheduled reminder"}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-medium ${statusClass}`}
                        >
                          {statusCopy}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
        {!notifSupported && (
          <p className="mt-3 text-xs text-muted-foreground">
            This browser doesn't support notifications.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          For reliable alerts while Student OS is closed, install this site to
          your phone’s home screen, allow notifications, and keep this setting
          on. You control categories, quiet hours, and the daily cap.
          Lock-screen alerts never include task titles, exam names, or lesson
          content.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Your data</h2>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Your workspace is private to your signed-in account and is kept
          locally for offline use. Export a backup for your own records, refresh
          only this device cache from cloud, or permanently delete the workspace
          everywhere.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-full bg-card"
            onClick={doExport}
          >
            <Download className="mr-1.5 h-4 w-4" /> Export backup
          </Button>
          <Button
            variant="outline"
            className="rounded-full bg-card"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1.5 h-4 w-4" /> Import backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={onImport}
          />
          <Button
            variant="outline"
            className="rounded-full bg-card"
            onClick={() => void refreshDeviceCache()}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh this device cache
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="rounded-full bg-card text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete workspace
                everywhere
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete this workspace everywhere?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your cloud workspace and this device
                  cache, including tasks, sessions, flashcards, exams, goals,
                  materials metadata, and settings. This cannot be undone.
                  Export a backup first if you want to keep anything.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void deleteEverywhere()}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Yes, delete everywhere
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Onboarding</h2>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Want to update your learning details? Restart onboarding anytime. Your
          private workspace remains synced to your account.
        </p>
        <Button
          variant="outline"
          className="mt-4 rounded-full bg-card"
          onClick={async () => {
            const restarted = await restartOnboarding();
            if (!restarted)
              toast.error(
                "Onboarding could not be restarted. Please try again."
              );
          }}
        >
          Restart onboarding
        </Button>
      </section>

      <p className="mt-6 pb-4 text-center text-[11px] text-muted-foreground">
        Student OS · offline-first · version 1.4
      </p>
    </div>
  );
}
