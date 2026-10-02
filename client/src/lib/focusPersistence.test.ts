import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearActiveFocusTimer,
  loadActiveFocusTimer,
  remainingFromAnchor,
  saveActiveFocusTimer,
  type PersistedFocusTimer,
} from "./focusPersistence";

const timer: PersistedFocusTimer = {
  sessionId: "focus-1",
  phase: "focus",
  durationSeconds: 300,
  remainingSeconds: 300,
  running: true,
  startedAt: 1_000,
  endsAt: 301_000,
  subject: "Maths",
  taskId: "",
  topicId: "",
  objective: "Algebra",
};

describe("durable focus timer anchors", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("derives remaining time from endsAt after the tab was suspended", () => {
    expect(remainingFromAnchor(timer, 121_001)).toBe(180);
    expect(remainingFromAnchor(timer, 302_000)).toBe(0);
  });

  it("persists one account's timer without exposing it to another account", () => {
    expect(saveActiveFocusTimer("account-a", timer)).toBe(true);
    expect(loadActiveFocusTimer("account-a")).toEqual(timer);
    expect(loadActiveFocusTimer("account-b")).toBeNull();
    expect(clearActiveFocusTimer("account-a")).toBe(true);
    expect(loadActiveFocusTimer("account-a")).toBeNull();
  });

  it("rejects a running timer without a clock anchor", () => {
    expect(
      saveActiveFocusTimer("account-a", { ...timer, endsAt: undefined })
    ).toBe(true);
    expect(loadActiveFocusTimer("account-a")).toBeNull();
  });
});
