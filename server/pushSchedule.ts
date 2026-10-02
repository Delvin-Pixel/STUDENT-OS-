import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import {
  claimPushReminder,
  disablePushDeviceByEndpoint,
  duePushReminders,
  finalizePushReminderFailure,
  isActivePushSchedule,
  markPushReminderSent,
  pushDeliveryStatusFromResponse,
  recordPushDeliveryHistory,
} from "./pushDb";
import { logOperationalFailure } from "./safeOperationalLog";
import { sendWebPush } from "./webPush";

/**
 * The durable schedule record is the allowlist. It permits safe task-token rotation after a
 * session signing change while rejecting every other authenticated cron identity.
 */
export async function isLivePushDispatchTask(actor: {
  isCron?: boolean;
  taskUid?: string;
}): Promise<boolean> {
  return (
    actor.isCron === true &&
    Boolean(actor.taskUid) &&
    (await isActivePushSchedule(actor.taskUid!))
  );
}

/** Dispatches due push reminders from a managed Heartbeat callback. */
export async function dispatchScheduledPush(req: Request, res: Response) {
  try {
    const actor = await sdk.authenticateRequest(req as unknown as Request);
    if (!(await isLivePushDispatchTask(actor))) {
      res.status(403).json({ error: "Unrecognised scheduled push callback." });
      return;
    }

    const deliveries = await duePushReminders();
    let sent = 0;
    let removed = 0;
    let retired = 0;
    for (const { reminder, device } of deliveries) {
      const attempt = reminder.deliveryAttempts + 1;
      if (!(await claimPushReminder(reminder.id, reminder.deliveryAttempts)))
        continue;
      try {
        const result = await sendWebPush(
          {
            endpoint: device.endpoint,
            p256dh: device.p256dh,
            auth: device.auth,
          },
          {
            title: reminder.title,
            body: reminder.body,
            targetUrl: reminder.targetUrl,
            tag: reminder.dedupeKey,
            vibration: reminder.vibration ?? undefined,
          }
        );
        const status = pushDeliveryStatusFromResponse(result.ok, result.status);
        await recordPushDeliveryHistory({
          deviceId: device.id,
          reminderId: reminder.id,
          kind: "reminder",
          status,
          responseCode: result.status,
        });
        if (result.ok) {
          await markPushReminderSent(reminder.id);
          sent += 1;
        } else if (status === "expired") {
          await disablePushDeviceByEndpoint(device.endpoint);
          await markPushReminderSent(reminder.id);
          removed += 1;
        } else {
          const disposition = await finalizePushReminderFailure(
            reminder.id,
            attempt
          );
          if (disposition.retired) retired += 1;
        }
      } catch (error) {
        await recordPushDeliveryHistory({
          deviceId: device.id,
          reminderId: reminder.id,
          kind: "reminder",
          status: "failed",
        });
        const disposition = await finalizePushReminderFailure(
          reminder.id,
          attempt
        );
        if (disposition.retired) retired += 1;
        logOperationalFailure(
          "Push",
          "Scheduled delivery attempt failed",
          error
        );
      }
    }
    res.json({
      ok: true,
      inspected: deliveries.length,
      sent,
      removed,
      retired,
    });
  } catch (error) {
    logOperationalFailure("Push", "Scheduled dispatch rejected", error);
    res.status(401).json({ error: "Scheduled push authentication failed." });
  }
}
