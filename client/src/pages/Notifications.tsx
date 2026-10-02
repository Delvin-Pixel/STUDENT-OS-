import { Button } from "@/components/ui/button";
import { useStore } from "@/contexts/StoreContext";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, Trash2 } from "lucide-react";

const TYPE_LABEL = {
  info: "Update",
  success: "Progress",
  warning: "Reminder",
} as const;

export default function Notifications() {
  const { state, markAllRead, markNotificationRead, clearNotifications } =
    useStore();
  const notifications = [...state.notifications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const unread = notifications.filter(item => !item.read).length;
  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">
            Notification center
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Keep up with your study life.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review reminders and progress updates stored in your private
            workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={!unread}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearNotifications}
            disabled={!notifications.length}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>
      {notifications.length ? (
        <div className="mt-6 space-y-2">
          {notifications.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => markNotificationRead(item.id)}
              className={cn(
                "w-full rounded-2xl border p-4 text-left transition-colors",
                item.read
                  ? "border-border bg-card"
                  : "border-primary/30 bg-primary/5"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {TYPE_LABEL[item.type]}
                </span>
                {!item.read ? (
                  <span
                    className="h-2 w-2 rounded-full bg-primary"
                    aria-label="Unread"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">
                {item.text}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 font-display text-lg font-semibold">
            Nothing new right now
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Study reminders and progress updates will appear here.
          </p>
        </div>
      )}
    </section>
  );
}
