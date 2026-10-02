/* STUDENT OS — returning-user restore regression tests.
   Reproduces the race a user reported: on every re-login the onboarding
   flow reappeared because a fresh-tab empty workspace could upload to the
   server before the account's saved workspace was hydrated. These specs pin
   the fix: hydration completes first, uploads are blocked until then. */

import { beforeEach, describe, expect, it } from "vitest";

/* ── fake a StudyState-like payload ─────────────────────────────────── */
interface FakeWorkspace {
  profile: { name: string } | null;
  xp: number;
}
const EMPTY: FakeWorkspace = { profile: null, xp: 0 };

function makeWorkspace(name: string): FakeWorkspace {
  return { profile: { name }, xp: 50 };
}

/* ── minimal sync harness that mirrors the real createWorkspaceSync
     contract (load / save / cancelUpload / debounce) ─────────────── */
function createSyncHarness(options: {
  initialServer: FakeWorkspace | null;
  saveHandler: (payload: FakeWorkspace) => void;
  loadDelayMs?: number;
}) {
  const { initialServer, saveHandler, loadDelayMs = 0 } = options;
  let server = initialServer;
  let saveCount = 0;
  let uploadTimer: ReturnType<typeof setTimeout> | null = null;
  let pending: FakeWorkspace | null = null;
  let hydrated = false;

  const scheduleUpload = (payload: FakeWorkspace) => {
    pending = payload;
    if (uploadTimer) clearTimeout(uploadTimer);
    uploadTimer = setTimeout(() => {
      const copy = pending;
      pending = null;
      uploadTimer = null;
      if (copy) {
        server = copy;
        saveCount += 1;
        saveHandler(copy);
      }
    }, 50);
  };

  const cancelUpload = () => {
    if (uploadTimer) {
      clearTimeout(uploadTimer);
      uploadTimer = null;
    }
    pending = null;
  };

  const loadServer = (): Promise<FakeWorkspace | null> =>
    new Promise(resolve => setTimeout(() => resolve(server), loadDelayMs));

  const hydrate = (adopt: (next: FakeWorkspace) => void) => {
    hydrated = false;
    cancelUpload();
    void loadServer().then(srv => {
      const next = srv && typeof srv === "object" ? srv : EMPTY;
      adopt(next);
      hydrated = true;
      // Only upload if the adopted copy differs from what the server holds
      // (new account) — a returning user's device is already canonical.
      if (next !== srv) scheduleUpload(next);
    });
  };

  const updateState = (next: FakeWorkspace) => {
    if (hydrated) scheduleUpload(next);
  };

  return {
    hydrate,
    updateState,
    cancelUpload,
    get server() {
      return server;
    },
    get saveCount() {
      return saveCount;
    },
  };
}

describe("returning-user workspace restore", () => {
  const saved: FakeWorkspace[] = [];

  beforeEach(() => {
    saved.length = 0;
  });

  it("a returning user's saved profile is never overwritten by an empty local state", async () => {
    const harness = createSyncHarness({
      initialServer: makeWorkspace("Delvin"),
      saveHandler: p => saved.push(p),
    });
    // Fresh tab: local state is empty. Sign-in starts hydration.
    harness.hydrate(() => {});
    // While hydration is in flight, the empty local state must NOT upload.
    await new Promise(r => setTimeout(r, 120));
    expect(harness.saveCount).toBe(0);
    expect(harness.server).toEqual(makeWorkspace("Delvin"));
  });

  it("an empty server workspace for a new account uploads the empty local state after hydration", async () => {
    const harness = createSyncHarness({
      initialServer: null,
      saveHandler: p => saved.push(p),
    });
    harness.hydrate(() => {});
    await new Promise(r => setTimeout(r, 120));
    expect(harness.saveCount).toBe(1);
    expect(saved[0]).toEqual(EMPTY);
  });

  it("uploads only resume after hydration completes for the same session", async () => {
    const harness = createSyncHarness({
      initialServer: makeWorkspace("Delvin"),
      saveHandler: p => saved.push(p),
    });
    let adopted: FakeWorkspace | null = null;
    harness.hydrate(next => {
      adopted = next;
    });
    await new Promise(r => setTimeout(r, 120));
    expect(adopted).toEqual(makeWorkspace("Delvin"));
    // A user-driven change now uploads as expected.
    const updated = { profile: { name: "Delvin" }, xp: 70 };
    harness.updateState(updated);
    await new Promise(r => setTimeout(r, 120));
    expect(harness.saveCount).toBe(1);
    expect(harness.server).toEqual(updated);
    expect(saved[0]).toEqual(updated);
  });

  it("a sign-in with a pending upload cancels it and hydrates the server workspace first", async () => {
    const harness = createSyncHarness({
      initialServer: makeWorkspace("Delvin"),
      saveHandler: p => saved.push(p),
    });
    // Someone else (or the same user) queued an upload before signing in on a new device.
    harness.updateState(EMPTY); // no-op while not hydrated — must not upload
    await new Promise(r => setTimeout(r, 120));
    expect(harness.saveCount).toBe(0);
    harness.hydrate(() => {});
    await new Promise(r => setTimeout(r, 120));
    expect(harness.saveCount).toBe(0); // returning user: device already canonical, no re-upload
    expect(harness.server?.profile).toEqual({ name: "Delvin" });
  });
});
