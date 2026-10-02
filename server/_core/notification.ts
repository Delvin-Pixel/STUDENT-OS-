import { TRPCError } from "@trpc/server";
import { logOperationalFailure } from "../safeOperationalLog";
import { ENV } from "./env";

export type NotificationPayload = { title: string; content: string };

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20_000;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  if (!content)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  if (title.length > TITLE_MAX_LENGTH)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  if (content.length > CONTENT_MAX_LENGTH)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  return { title, content };
};

/** Sends owner/admin alerts through a configured, vendor-neutral webhook. */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);
  if (!ENV.ownerNotificationWebhookUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Owner notification webhook is not configured.",
    });
  }

  try {
    const response = await fetch(ENV.ownerNotificationWebhookUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(ENV.ownerNotificationWebhookKey
          ? { authorization: `Bearer ${ENV.ownerNotificationWebhookKey}` }
          : {}),
      },
      body: JSON.stringify({ title, content, source: "student-os" }),
    });
    if (!response.ok) {
      logOperationalFailure(
        "Notification",
        "Owner notification webhook failed",
        new Error(`upstream-status-${response.status}`)
      );
      return false;
    }
    return true;
  } catch (error) {
    logOperationalFailure(
      "Notification",
      "Owner notification webhook errored",
      error
    );
    return false;
  }
}
