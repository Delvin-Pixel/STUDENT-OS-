import { query } from '@/lib/db';

const POLL_INTERVAL_MS = 750;

type CancellationWatcher = {
  stop: () => void;
};

export function startWorkflowCancellationWatcher(input: {
  userId: string;
  workflowId: string;
  controller: AbortController;
  intervalMs?: number;
}): CancellationWatcher {
  let stopped = false;
  const intervalMs = Math.max(250, Math.min(5_000, Number(input.intervalMs ?? POLL_INTERVAL_MS)));

  const poll = async () => {
    if (stopped || input.controller.signal.aborted) return;
    try {
      const result = await query<{ status: string }>(
        `select status from workflows where id = $1 and user_id = $2 limit 1`,
        [input.workflowId, input.userId],
      );
      const status = result.rows[0]?.status ?? null;
      if (status === 'cancelled' && !input.controller.signal.aborted) {
        input.controller.abort('NEXA_WORKFLOW_CANCELLED');
      }
    } catch {
      // Cancellation polling is advisory; workflow state guards remain authoritative.
    }
  };

  void poll();
  const timer = setInterval(() => void poll(), intervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
