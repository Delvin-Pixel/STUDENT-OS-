import type { DevicePushSubscription, PlannedPushReminder } from "./devicePush";

export type PushActivationResult = {
  endpoint: string;
  scheduled: number;
};

type PushActivationDependencies = {
  subscription: DevicePushSubscription;
  reminders: PlannedPushReminder[];
  vibration?: number[];
  activate: (input: {
    subscription: DevicePushSubscription;
    reminders: PlannedPushReminder[];
  }) => Promise<PushActivationResult>;
  sendTest: (input: {
    endpoint: string;
    vibration?: number[];
  }) => Promise<{ accepted: boolean }>;
  rollback: (endpoint: string) => Promise<void>;
};

/**
 * A successful browser permission prompt is not an activation. Activation is complete only
 * after the device is persisted, reminders are saved, and the push service accepts the test.
 */
export async function activateAndVerifyPhonePush({
  subscription,
  reminders,
  vibration,
  activate,
  sendTest,
  rollback,
}: PushActivationDependencies): Promise<PushActivationResult> {
  let activatedEndpoint: string | null = null;
  try {
    const activation = await activate({ subscription, reminders });
    if (!activation.endpoint || activation.endpoint !== subscription.endpoint) {
      throw new Error(
        "Student OS could not verify the registered phone device. Please try again."
      );
    }
    activatedEndpoint = activation.endpoint;
    const test = await sendTest({ endpoint: activation.endpoint, vibration });
    if (!test.accepted) {
      throw new Error(
        "The phone push service did not accept the activation test. Please try again."
      );
    }
    return activation;
  } catch (error) {
    if (activatedEndpoint) {
      try {
        await rollback(activatedEndpoint);
      } catch {
        // The original activation failure is more useful. A later explicit retry re-registers safely.
      }
    }
    throw error;
  }
}
