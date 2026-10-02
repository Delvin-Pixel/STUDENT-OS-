import {
  and,
  desc as drizzleDesc,
  inArray as drizzleInArray,
  eq,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import {
  pushDeliveryHistory,
  pushDevices,
  pushReminders,
  pushSchedules,
} from "../drizzle/schema";
import { getDb } from "./db";
import { assertSafeWebPushEndpoint } from "./webPush";

export type DevicePushInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PlannedPushReminder = {
  dedupeKey: string;
  title: string;
  body: string;
  targetUrl: string;
  vibration?: number[];
  fireAt: Date;
};

/** The database is the final guard; this also makes a repeated client planner idempotent before insert. */
export function dedupePlannedPushReminders(reminders: PlannedPushReminder[]) {
  const byKey = new Map<string, PlannedPushReminder>();
  for (const reminder of reminders) byKey.set(reminder.dedupeKey, reminder);
  return Array.from(byKey.values());
}

export type PushDeliveryStatus = "accepted" | "failed" | "expired";
export const PUSH_DELIVERY_HISTORY_LIMIT = 30;
export const PUSH_REMINDER_MAX_ATTEMPTS = 3;
export const PUSH_CONNECTION_TEST_COOLDOWN_MS = 60_000;
const PUSH_ATTEMPT_LEASE_MS = 2 * 60 * 1000;

export function pushRetryDelayMs(attempt: number) {
  return [60_000, 5 * 60_000][Math.max(0, attempt - 1)] ?? 30 * 60_000;
}

export function pushRetryDisposition(attempt: number, now = new Date()) {
  if (attempt >= PUSH_REMINDER_MAX_ATTEMPTS)
    return { retired: true as const, nextAttemptAt: null };
  return {
    retired: false as const,
    nextAttemptAt: new Date(now.getTime() + pushRetryDelayMs(attempt)),
  };
}

export function pushConnectionTestCooldownActive(
  lastTestedAt: Date | null | undefined,
  now = new Date()
) {
  return Boolean(
    lastTestedAt &&
    now.getTime() - lastTestedAt.getTime() < PUSH_CONNECTION_TEST_COOLDOWN_MS
  );
}

function affectedRows(result: unknown) {
  const candidate = Array.isArray(result) ? result[0] : result;
  if (!candidate || typeof candidate !== "object") return 0;
  const value =
    (candidate as { rowsAffected?: unknown; affectedRows?: unknown })
      .rowsAffected ?? (candidate as { affectedRows?: unknown }).affectedRows;
  return typeof value === "number" ? value : 0;
}

/** Browser endpoints are opaque device credentials and must never silently move between accounts. */
export function assertPushEndpointOwner(
  existingOpenId: string | null | undefined,
  requestedOpenId: string
) {
  if (existingOpenId && existingOpenId !== requestedOpenId) {
    throw new Error(
      "This phone is already registered to another Student OS account. Disable reminders in that account before registering it here."
    );
  }
}

export function isDuplicatePushEndpointError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === "ER_DUP_ENTRY" ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("Duplicate entry"))
  );
}

/** Maps a Web Push response into learner-friendly delivery semantics. */
export function pushDeliveryStatusFromResponse(
  ok: boolean,
  status?: number
): PushDeliveryStatus {
  if (ok) return "accepted";
  return status === 404 || status === 410 ? "expired" : "failed";
}

export async function upsertPushDevice(input: DevicePushInput, openId: string) {
  assertSafeWebPushEndpoint(input.endpoint);
  const db = await getDb();
  if (!db)
    throw new Error("The Student OS push service is temporarily unavailable.");
  const existing = await db
    .select({ openId: pushDevices.openId })
    .from(pushDevices)
    .where(eq(pushDevices.endpoint, input.endpoint))
    .limit(1);
  assertPushEndpointOwner(existing[0]?.openId, openId);
  const updateOwnedDevice = () =>
    db
      .update(pushDevices)
      .set({
        p256dh: input.p256dh,
        auth: input.auth,
        enabled: true,
        lastSeenAt: new Date(),
      })
      .where(
        and(
          eq(pushDevices.endpoint, input.endpoint),
          eq(pushDevices.openId, openId)
        )
      );

  if (existing[0]) {
    // Existing credentials are updated only under the already-proven owner.
    // `openId` is deliberately never included in this update.
    await updateOwnedDevice();
  } else {
    try {
      await db
        .insert(pushDevices)
        .values({ ...input, openId, enabled: true, lastSeenAt: new Date() });
    } catch (error) {
      // A second account may have inserted the same browser endpoint after the
      // initial read. Re-read and prove ownership before any update; unlike an
      // ON DUPLICATE KEY UPDATE this branch can never transfer the endpoint.
      if (!isDuplicatePushEndpointError(error)) throw error;
      const winner = await db
        .select({ openId: pushDevices.openId })
        .from(pushDevices)
        .where(eq(pushDevices.endpoint, input.endpoint))
        .limit(1);
      assertPushEndpointOwner(winner[0]?.openId, openId);
      if (!winner[0]) throw error;
      await updateOwnedDevice();
    }
  }
  const rows = await db
    .select()
    .from(pushDevices)
    .where(eq(pushDevices.endpoint, input.endpoint))
    .limit(1);
  if (!rows[0])
    throw new Error("The Student OS push device could not be saved.");
  // Re-registration replaces the local plan, so obsolete pending alerts cannot survive.
  await db
    .delete(pushReminders)
    .where(
      and(eq(pushReminders.deviceId, rows[0].id), isNull(pushReminders.sentAt))
    );
  return rows[0];
}

/** Finds an enabled opaque browser endpoint before attempting a user-initiated diagnostic push. */
export async function getEnabledPushDevice(endpoint: string, openId: string) {
  const db = await getDb();
  if (!db)
    throw new Error("The Student OS push service is temporarily unavailable.");
  const rows = await db
    .select()
    .from(pushDevices)
    .where(
      and(
        eq(pushDevices.endpoint, endpoint),
        eq(pushDevices.openId, openId),
        eq(pushDevices.enabled, true)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Atomically reserves a user-requested push test, including across concurrent server instances. */
export async function claimPushConnectionTest(
  deviceId: number,
  now = new Date()
) {
  const db = await getDb();
  if (!db)
    throw new Error("The Student OS push service is temporarily unavailable.");
  const cutoff = new Date(now.getTime() - PUSH_CONNECTION_TEST_COOLDOWN_MS);
  const result = await db
    .update(pushDevices)
    .set({ lastTestedAt: now })
    .where(
      and(
        eq(pushDevices.id, deviceId),
        or(
          isNull(pushDevices.lastTestedAt),
          lte(pushDevices.lastTestedAt, cutoff)
        )
      )
    );
  return affectedRows(result) === 1;
}

export async function replaceDevicePushReminders(
  endpoint: string,
  reminders: PlannedPushReminder[],
  openId: string
) {
  const db = await getDb();
  if (!db)
    throw new Error("The Student OS push service is temporarily unavailable.");
  const uniqueReminders = dedupePlannedPushReminders(reminders);
  await db.transaction(async tx => {
    const [device] = await tx
      .select()
      .from(pushDevices)
      .where(
        and(eq(pushDevices.endpoint, endpoint), eq(pushDevices.openId, openId))
      )
      .limit(1);
    if (!device)
      throw new Error("Register this device before scheduling reminders.");
    await tx
      .delete(pushReminders)
      .where(
        and(eq(pushReminders.deviceId, device.id), isNull(pushReminders.sentAt))
      );
    if (uniqueReminders.length) {
      await tx.insert(pushReminders).values(
        uniqueReminders.map(reminder => ({
          ...reminder,
          deviceId: device.id,
        }))
      );
    }
  });
  return { scheduled: uniqueReminders.length };
}

/**
 * Registers the opaque browser endpoint and replaces its unsent reminder plan in one transaction.
 * This prevents a Settings activation from observing a half-complete register-then-sync state.
 */
export async function activatePushDevice(
  input: DevicePushInput,
  reminders: PlannedPushReminder[],
  openId: string
) {
  assertSafeWebPushEndpoint(input.endpoint);
  const db = await getDb();
  if (!db)
    throw new Error("The Student OS push service is temporarily unavailable.");
  const uniqueReminders = dedupePlannedPushReminders(reminders);

  return db.transaction(async tx => {
    const [existing] = await tx
      .select({ openId: pushDevices.openId })
      .from(pushDevices)
      .where(eq(pushDevices.endpoint, input.endpoint))
      .limit(1);
    assertPushEndpointOwner(existing?.openId, openId);

    const updateOwnedDevice = () =>
      tx
        .update(pushDevices)
        .set({
          p256dh: input.p256dh,
          auth: input.auth,
          enabled: true,
          lastSeenAt: new Date(),
        })
        .where(
          and(
            eq(pushDevices.endpoint, input.endpoint),
            eq(pushDevices.openId, openId)
          )
        );

    if (existing) {
      await updateOwnedDevice();
    } else {
      try {
        await tx
          .insert(pushDevices)
          .values({ ...input, openId, enabled: true, lastSeenAt: new Date() });
      } catch (error) {
        if (!isDuplicatePushEndpointError(error)) throw error;
        const [winner] = await tx
          .select({ openId: pushDevices.openId })
          .from(pushDevices)
          .where(eq(pushDevices.endpoint, input.endpoint))
          .limit(1);
        assertPushEndpointOwner(winner?.openId, openId);
        if (!winner) throw error;
        await updateOwnedDevice();
      }
    }

    const [device] = await tx
      .select({ id: pushDevices.id, endpoint: pushDevices.endpoint })
      .from(pushDevices)
      .where(
        and(
          eq(pushDevices.endpoint, input.endpoint),
          eq(pushDevices.openId, openId)
        )
      )
      .limit(1);
    if (!device)
      throw new Error("The Student OS push device could not be saved.");

    await tx
      .delete(pushReminders)
      .where(
        and(eq(pushReminders.deviceId, device.id), isNull(pushReminders.sentAt))
      );
    if (uniqueReminders.length) {
      await tx.insert(pushReminders).values(
        uniqueReminders.map(reminder => ({
          ...reminder,
          deviceId: device.id,
        }))
      );
    }
    return {
      endpoint: device.endpoint,
      scheduled: uniqueReminders.length,
    } as const;
  });
}

/**
 * Reconciles a browser's current push subscription with its previously
 * registered subscription without affecting other devices on the account.
 * A browser subscription can rotate; leaving the old endpoint enabled would
 * otherwise create duplicate reminder delivery.
 */
export async function reconcilePushDevice(
  input: DevicePushInput,
  reminders: PlannedPushReminder[],
  openId: string,
  previousEndpoint?: string | null
) {
  assertSafeWebPushEndpoint(input.endpoint);
  if (previousEndpoint) assertSafeWebPushEndpoint(previousEndpoint);
  const db = await getDb();
  if (!db)
    throw new Error("The Student OS push service is temporarily unavailable.");
  const uniqueReminders = dedupePlannedPushReminders(reminders);

  return db.transaction(async tx => {
    // Disable only the caller's previous endpoint. Other phones belonging to
    // the same account remain enabled. A mismatched owner is never touched.
    if (previousEndpoint && previousEndpoint !== input.endpoint) {
      await tx
        .update(pushDevices)
        .set({ enabled: false, lastSeenAt: new Date() })
        .where(
          and(
            eq(pushDevices.endpoint, previousEndpoint),
            eq(pushDevices.openId, openId)
          )
        );
      const [previous] = await tx
        .select({ id: pushDevices.id })
        .from(pushDevices)
        .where(
          and(
            eq(pushDevices.endpoint, previousEndpoint),
            eq(pushDevices.openId, openId)
          )
        )
        .limit(1);
      if (previous) {
        await tx
          .delete(pushReminders)
          .where(
            and(
              eq(pushReminders.deviceId, previous.id),
              isNull(pushReminders.sentAt)
            )
          );
      }
    }

    const [existing] = await tx
      .select({ openId: pushDevices.openId })
      .from(pushDevices)
      .where(eq(pushDevices.endpoint, input.endpoint))
      .limit(1);
    assertPushEndpointOwner(existing?.openId, openId);

    const updateOwnedDevice = () =>
      tx
        .update(pushDevices)
        .set({
          p256dh: input.p256dh,
          auth: input.auth,
          enabled: true,
          lastSeenAt: new Date(),
        })
        .where(
          and(
            eq(pushDevices.endpoint, input.endpoint),
            eq(pushDevices.openId, openId)
          )
        );

    if (existing) {
      await updateOwnedDevice();
    } else {
      try {
        await tx
          .insert(pushDevices)
          .values({ ...input, openId, enabled: true, lastSeenAt: new Date() });
      } catch (error) {
        if (!isDuplicatePushEndpointError(error)) throw error;
        const [winner] = await tx
          .select({ openId: pushDevices.openId })
          .from(pushDevices)
          .where(eq(pushDevices.endpoint, input.endpoint))
          .limit(1);
        assertPushEndpointOwner(winner?.openId, openId);
        if (!winner) throw error;
        await updateOwnedDevice();
      }
    }

    const [device] = await tx
      .select({ id: pushDevices.id, endpoint: pushDevices.endpoint })
      .from(pushDevices)
      .where(
        and(
          eq(pushDevices.endpoint, input.endpoint),
          eq(pushDevices.openId, openId)
        )
      )
      .limit(1);
    if (!device)
      throw new Error("The Student OS push device could not be saved.");

    await tx
      .delete(pushReminders)
      .where(
        and(eq(pushReminders.deviceId, device.id), isNull(pushReminders.sentAt))
      );
    if (uniqueReminders.length) {
      await tx.insert(pushReminders).values(
        uniqueReminders.map(reminder => ({
          ...reminder,
          deviceId: device.id,
        }))
      );
    }
    return {
      endpoint: device.endpoint,
      scheduled: uniqueReminders.length,
    } as const;
  });
}

export async function disablePushDevice(endpoint: string, openId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pushDevices)
    .set({ enabled: false, lastSeenAt: new Date() })
    .where(
      and(eq(pushDevices.endpoint, endpoint), eq(pushDevices.openId, openId))
    );
}

/** Transport cleanup after a dead-subscription response; endpoint access is sufficient here. */
export async function disablePushDeviceByEndpoint(endpoint: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pushDevices)
    .set({ enabled: false, lastSeenAt: new Date() })
    .where(eq(pushDevices.endpoint, endpoint));
}

/** Records technical delivery outcomes only; a learner's reminder copy is never stored in this history. */
export async function recordPushDeliveryHistory(input: {
  deviceId: number;
  reminderId?: number | null;
  kind: "reminder" | "test";
  status: PushDeliveryStatus;
  responseCode?: number | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(pushDeliveryHistory).values({
    deviceId: input.deviceId,
    reminderId: input.reminderId ?? null,
    kind: input.kind,
    status: input.status,
    responseCode: input.responseCode ?? null,
  });
  const stale = await db
    .select({ id: pushDeliveryHistory.id })
    .from(pushDeliveryHistory)
    .where(eq(pushDeliveryHistory.deviceId, input.deviceId))
    .orderBy(
      drizzleDesc(pushDeliveryHistory.createdAt),
      drizzleDesc(pushDeliveryHistory.id)
    )
    .limit(200)
    .offset(PUSH_DELIVERY_HISTORY_LIMIT);
  if (stale.length)
    await db.delete(pushDeliveryHistory).where(
      drizzleInArray(
        pushDeliveryHistory.id,
        stale.map(entry => entry.id)
      )
    );
}

/** Returns recent outcome records for the exact opaque endpoint currently used by this device. */
export async function getPushDeliveryHistory(endpoint: string, openId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      kind: pushDeliveryHistory.kind,
      status: pushDeliveryHistory.status,
      responseCode: pushDeliveryHistory.responseCode,
      createdAt: pushDeliveryHistory.createdAt,
    })
    .from(pushDeliveryHistory)
    .innerJoin(pushDevices, eq(pushDeliveryHistory.deviceId, pushDevices.id))
    .where(
      and(eq(pushDevices.endpoint, endpoint), eq(pushDevices.openId, openId))
    )
    .orderBy(
      drizzleDesc(pushDeliveryHistory.createdAt),
      drizzleDesc(pushDeliveryHistory.id)
    )
    .limit(PUSH_DELIVERY_HISTORY_LIMIT);
}

export async function duePushReminders(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ reminder: pushReminders, device: pushDevices })
    .from(pushReminders)
    .innerJoin(pushDevices, eq(pushReminders.deviceId, pushDevices.id))
    .where(
      and(
        isNull(pushReminders.sentAt),
        isNull(pushReminders.retiredAt),
        lte(pushReminders.fireAt, new Date()),
        or(
          isNull(pushReminders.nextAttemptAt),
          lte(pushReminders.nextAttemptAt, new Date())
        ),
        eq(pushDevices.enabled, true)
      )
    )
    .limit(limit);
}

/** Claims a due reminder before transport to prevent overlapping Heartbeat runs from sending it twice. */
export async function claimPushReminder(
  id: number,
  deliveryAttempts: number,
  now = new Date()
) {
  const db = await getDb();
  if (!db) return false;
  const leaseUntil = new Date(now.getTime() + PUSH_ATTEMPT_LEASE_MS);
  const result = await db
    .update(pushReminders)
    .set({ deliveryAttempts: deliveryAttempts + 1, nextAttemptAt: leaseUntil })
    .where(
      and(
        eq(pushReminders.id, id),
        eq(pushReminders.deliveryAttempts, deliveryAttempts),
        isNull(pushReminders.sentAt),
        isNull(pushReminders.retiredAt),
        or(
          isNull(pushReminders.nextAttemptAt),
          lte(pushReminders.nextAttemptAt, now)
        )
      )
    );
  return affectedRows(result) === 1;
}

/** Finalizes a failed claimed transport with a bounded retry schedule or terminal retirement. */
export async function finalizePushReminderFailure(
  id: number,
  attempt: number,
  now = new Date()
) {
  const db = await getDb();
  if (!db) return { retired: false, nextAttemptAt: null };
  const disposition = pushRetryDisposition(attempt, now);
  await db
    .update(pushReminders)
    .set(
      disposition.retired
        ? { retiredAt: now, nextAttemptAt: null }
        : { nextAttemptAt: disposition.nextAttemptAt }
    )
    .where(
      and(
        eq(pushReminders.id, id),
        eq(pushReminders.deliveryAttempts, attempt),
        isNull(pushReminders.sentAt),
        isNull(pushReminders.retiredAt)
      )
    );
  return disposition;
}

export async function markPushReminderSent(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pushReminders)
    .set({ sentAt: new Date() })
    .where(eq(pushReminders.id, id));
}

export async function isActivePushSchedule(taskUid: string) {
  const db = await getDb();
  if (!db) return false;
  const schedules = await db
    .select()
    .from(pushSchedules)
    .where(eq(pushSchedules.taskUid, taskUid))
    .limit(1);
  return schedules.length > 0;
}
