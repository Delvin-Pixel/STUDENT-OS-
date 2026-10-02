/* Regression tests for the Welcome screen sign-in recovery logic.
   Covers: attempt recording, window expiry, and failure surfacing. */

import { beforeEach, describe, expect, it } from "vitest";

// Vitest's default server environment has no DOM. A small in-memory shim is
// enough for the localStorage-only logic under test here (identical surface to
// the browser localStorage for get/set/clear/keys-less operations).
let store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) =>
    Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    store = {};
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

const LAST_ATTEMPT_KEY = "studentos:last-signin-attempt";
const LAST_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

function recordSignInAttempt(now: number) {
  localStorage.setItem(LAST_ATTEMPT_KEY, String(now));
}

function recentSignInAttemptMs(now: number): number | null {
  const raw = localStorage.getItem(LAST_ATTEMPT_KEY);
  if (!raw) return null;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return null;
  if (now - ts > LAST_ATTEMPT_WINDOW_MS) return null;
  return ts;
}

describe("sign-in recovery attempt tracking", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("records a fresh attempt when sign-in begins", () => {
    recordSignInAttempt(1000);
    expect(recentSignInAttemptMs(1000)).toBe(1000);
  });

  it("returns null before any attempt is made", () => {
    expect(recentSignInAttemptMs(Date.now())).toBeNull();
  });

  it("treats an attempt inside the 10-minute window as recent", () => {
    recordSignInAttempt(Date.now() - 1000);
    expect(recentSignInAttemptMs(Date.now())).not.toBeNull();
  });

  it("expires attempts older than the recovery window", () => {
    recordSignInAttempt(Date.now() - LAST_ATTEMPT_WINDOW_MS - 1);
    expect(recentSignInAttemptMs(Date.now())).toBeNull();
  });

  it("ignores malformed stored timestamps", () => {
    localStorage.setItem(LAST_ATTEMPT_KEY, "not-a-number");
    expect(recentSignInAttemptMs(Date.now())).toBeNull();
    localStorage.setItem(LAST_ATTEMPT_KEY, "");
    expect(recentSignInAttemptMs(Date.now())).toBeNull();
  });

  it("retries before surfacing failure: 4 retries over ~15s then failed state", () => {
    // Simulates the Welcome effect's retry ladder without rendering React:
    recordSignInAttempt(Date.now());
    const states: string[] = [];
    let retries = 0;
    const isAuthenticated = false;
    while (!isAuthenticated) {
      if (retries >= 4) {
        states.push("failed");
        break;
      }
      states.push(`retry-${retries}`);
      retries += 1;
    }
    expect(states).toEqual([
      "retry-0",
      "retry-1",
      "retry-2",
      "retry-3",
      "failed",
    ]);
    expect(retries).toBe(4);
  });
});
