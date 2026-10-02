import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearWorkspaceConflict,
  loadWorkspaceConflict,
  saveWorkspaceConflict,
} from "./storage";

describe("workspace conflict recovery", () => {
  const openId = "account:conflict-test";

  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
    });
  });

  it("preserves the exact local payload and remote revision for later resolution", () => {
    const saved = saveWorkspaceConflict(openId, {
      detectedAt: "2026-08-31T10:00:00.000Z",
      remoteRevision: 12,
      localWorkspace: '{"tasks":[{"id":"local-only"}]}',
    });
    expect(saved).toBe(true);
    expect(loadWorkspaceConflict(openId)).toEqual({
      detectedAt: "2026-08-31T10:00:00.000Z",
      remoteRevision: 12,
      localWorkspace: '{"tasks":[{"id":"local-only"}]}',
    });
  });

  it("rejects malformed recovery payloads", () => {
    localStorage.setItem(
      "studentos:workspace-conflict:v1:account%3Aconflict-test",
      JSON.stringify({
        detectedAt: "now",
        remoteRevision: -1,
        localWorkspace: 42,
      })
    );
    expect(loadWorkspaceConflict(openId)).toBeNull();
  });

  it("can clear a resolved conflict snapshot", () => {
    saveWorkspaceConflict(openId, {
      detectedAt: "2026-08-31T10:00:00.000Z",
      remoteRevision: 13,
      localWorkspace: "{}",
    });
    expect(clearWorkspaceConflict(openId)).toBe(true);
    expect(loadWorkspaceConflict(openId)).toBeNull();
  });
});
