import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyState } from "./storage";
import {
  createOfflineIndexedDbCache,
  OFFLINE_CACHE_MAX_BYTES,
} from "./offlineIndexedDbCache";
import type {
  OfflineCacheBackend,
  OfflineStoredRecord,
} from "./offlineIndexedDbBackend";
import type { StudyState } from "./types";

type TestBackend = OfflineCacheBackend & {
  entries: Map<string, unknown>;
  failWrites: boolean;
  onRead: (() => void) | null;
};

function backend(): TestBackend {
  const entries = new Map<string, unknown>();
  const service: TestBackend = {
    entries,
    failWrites: false,
    onRead: null,
    async get(id) {
      const value = entries.get(id);
      service.onRead?.();
      return value;
    },
    async compareAndSwap(id, expected, next) {
      if (service.failWrites) throw new Error("quota exceeded");
      const current = entries.get(id) as OfflineStoredRecord | undefined;
      if (
        expected === null ? current !== undefined : current?.sha256 !== expected
      )
        return false;
      entries.set(id, structuredClone(next));
      return true;
    },
    async remove(id) {
      entries.delete(id);
    },
  };
  return service;
}

function makeHarness() {
  const memory = backend();
  let identity: string | null = "account-A";
  const service = createOfflineIndexedDbCache({
    currentAuthenticatedAccountId: () => identity,
    backend: memory,
  });
  return {
    ...service,
    memory,
    setIdentity: (next: string | null) => {
      identity = next;
    },
  };
}

function stateFor(name: string): StudyState {
  const state = emptyState();
  state.profile = {
    name,
    studentType: "Secondary School",
    educationLevel: "Secondary",
    goals: [],
    subjects: ["Mathematics"],
    hoursPerDay: "1 hour",
  };
  return state;
}

describe("B64.2 account-scoped checksummed cache", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("returns missing without implicitly modifying legacy localStorage", async () => {
    const cache = makeHarness();
    expect(await cache.read("account-A")).toEqual({ kind: "missing" });
    expect(cache.memory.entries.size).toBe(0);
  });

  it("writes, verifies and restores a workspace with account meta", async () => {
    const cache = makeHarness();
    const state = stateFor("Amina");
    const saved = await cache.save("account-A", state, 7, true, null);
    expect(saved).toMatchObject({ kind: "saved" });
    const read = await cache.read("account-A");
    expect(read).toMatchObject({
      kind: "ready",
      state: { profile: { name: "Amina" } },
      metadata: { revision: 7, pending: true },
      checksum: saved.checksum,
    });
  });

  it("never stores short-lived signed material or profile-photo URLs", async () => {
    const cache = makeHarness();
    const state = stateFor("Amina");
    if (!state.profile) throw new Error("fixture");
    state.profile.profilePhotoUrl = "https://signed.example/photo-key";
    state.studyMaterials.push({
      id: "material-1",
      title: "WASSCE Physics",
      subject: "Physics",
      fileName: "circuits.pdf",
      mimeType: "application/pdf",
      storageKey: "account-A/private/circuits.pdf",
      url: "https://signed.example/material-token",
      sizeBytes: 15,
      addedAt: "2026-10-26T00:00:00.000Z",
    });
    expect((await cache.save("account-A", state, 1, true, null)).kind).toBe(
      "saved"
    );
    const raw = cache.memory.entries.get("account-A") as OfflineStoredRecord;
    expect(raw.json).not.toContain("signed.example");
    const read = await cache.read("account-A");
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    expect(read.state.profile?.profilePhotoUrl).toBe("");
    expect(read.state.studyMaterials[0].url).toBe("");
    expect(read.state.studyMaterials[0].storageKey).toBe(
      "account-A/private/circuits.pdf"
    );
  });

  it("rejects cross-account reads, writes, migrations and clear attempts", async () => {
    const cache = makeHarness();
    expect(await cache.read("account-B")).toEqual({ kind: "denied" });
    expect(
      await cache.save("account-B", stateFor("Kojo"), 0, true, null)
    ).toEqual({ kind: "denied" });
    const reader = vi.fn(async () => null);
    expect(await cache.migrateReadOnlyLegacy("account-B", reader)).toEqual({
      kind: "denied",
    });
    expect(await cache.clearAccount("account-B")).toBe("denied");
    expect(reader).not.toHaveBeenCalled();
    expect(cache.memory.entries.size).toBe(0);
  });

  it("prevents stale simultaneous updates from silently overwriting each other", async () => {
    const cache = makeHarness();
    const first = await cache.save(
      "account-A",
      stateFor("Amina"),
      1,
      true,
      null
    );
    if (first.kind !== "saved") throw new Error("fixture");
    const accepted = await cache.save(
      "account-A",
      stateFor("Updated Amina"),
      1,
      true,
      first.checksum!
    );
    expect(accepted.kind).toBe("saved");
    const stale = await cache.save(
      "account-A",
      stateFor("Stale overwrite"),
      1,
      true,
      first.checksum!
    );
    expect(stale).toEqual({ kind: "conflict" });
    const read = await cache.read("account-A");
    expect(read.kind === "ready" && read.state.profile?.name).toBe(
      "Updated Amina"
    );
  });

  it("detects workspace corruption and preserves the original record for recovery", async () => {
    const cache = makeHarness();
    await cache.save("account-A", stateFor("Amina"), 2, false, null);
    const original = cache.memory.entries.get(
      "account-A"
    ) as OfflineStoredRecord;
    const corrupt = {
      ...original,
      json: original.json.replace("Amina", "Kojo"),
    };
    cache.memory.entries.set("account-A", corrupt);
    expect(await cache.read("account-A")).toEqual({
      kind: "recovery_required",
    });
    const fallback = vi.fn(async () => ({
      json: JSON.stringify(stateFor("Old legacy")),
      revision: 0,
      pending: true,
    }));
    expect(await cache.migrateReadOnlyLegacy("account-A", fallback)).toEqual({
      kind: "recovery_required",
    });
    expect(cache.memory.entries.get("account-A")).toEqual(corrupt);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("checks metadata integrity, including revision and ownership", async () => {
    const cache = makeHarness();
    await cache.save("account-A", stateFor("Amina"), 9, true, null);
    const original = cache.memory.entries.get(
      "account-A"
    ) as OfflineStoredRecord;
    cache.memory.entries.set("account-A", { ...original, revision: 99 });
    expect(await cache.read("account-A")).toEqual({
      kind: "recovery_required",
    });
    cache.memory.entries.set("account-A", {
      ...original,
      accountId: "account-B",
    });
    expect(await cache.read("account-A")).toEqual({
      kind: "recovery_required",
    });
  });

  it("does not accept structurally invalid or semantically corrupt workspaces", async () => {
    const cache = makeHarness();
    const broken = stateFor("Amina");
    broken.syncTombstones.push({
      collection: "tasks",
      id: "task-1",
      deletedAt: "2026-10-26T00:00:00.000Z",
    });
    broken.tasks.push({
      id: "task-1",
      title: "Conflict",
      description: "",
      subject: "Mathematics",
      dueDate: "",
      priority: "high",
      status: "todo",
      createdAt: "2026-10-26T00:00:00.000Z",
    });
    expect(await cache.save("account-A", broken, 2, true, null)).toEqual({
      kind: "invalid",
    });
    expect(cache.memory.entries.size).toBe(0);
  });

  it("enforces maximum size before attempting storage", async () => {
    const cache = makeHarness();
    const huge = stateFor("Amina");
    huge.notes = Array.from({ length: 220 }, (_, i) => ({
      id: "note-" + i,
      title: "Note",
      subject: "Mathematics",
      content: "a".repeat(20_000),
      pinned: false,
      createdAt: "2026-10-26T00:00:00.000Z",
      updatedAt: "2026-10-26T00:00:00.000Z",
    }));
    expect(JSON.stringify(huge).length).toBeGreaterThan(
      OFFLINE_CACHE_MAX_BYTES
    );
    expect(await cache.save("account-A", huge, 0, true, null)).toEqual({
      kind: "invalid",
    });
  });

  it("preserves the original localStorage snapshot during migration", async () => {
    const cache = makeHarness();
    const legacy = {
      json: JSON.stringify(stateFor("Amina")),
      revision: 11,
      pending: true,
    };
    const reader = vi.fn(async () => legacy);
    expect(await cache.migrateReadOnlyLegacy("account-A", reader)).toEqual({
      kind: "migrated",
    });
    expect(reader).toHaveBeenCalledWith("account-A");
    expect(legacy.json).toContain("Amina");
    expect(await cache.read("account-A")).toMatchObject({
      kind: "ready",
      metadata: { revision: 11, pending: true },
    });
    expect(await cache.migrateReadOnlyLegacy("account-A", reader)).toEqual({
      kind: "already_present",
    });
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("does not migrate absent or corrupt legacy snapshots", async () => {
    const cache = makeHarness();
    expect(
      await cache.migrateReadOnlyLegacy("account-A", async () => null)
    ).toEqual({ kind: "legacy_missing" });
    expect(
      await cache.migrateReadOnlyLegacy("account-A", async () => ({
        json: "not json",
        revision: 1,
        pending: true,
      }))
    ).toEqual({ kind: "legacy_invalid" });
    expect(cache.memory.entries.size).toBe(0);
  });

  it("does not overwrite a concurrent IndexedDB record during migration", async () => {
    const cache = makeHarness();
    const result = await cache.migrateReadOnlyLegacy("account-A", async () => {
      expect(
        await cache.save("account-A", stateFor("Other writer"), 3, false, null)
      ).toMatchObject({ kind: "saved" });
      return {
        json: JSON.stringify(stateFor("Amina")),
        revision: 3,
        pending: true,
      };
    });
    expect(result).toEqual({ kind: "raced" });
    const persisted = await cache.read("account-A");
    expect(persisted.kind === "ready" && persisted.state.profile?.name).toBe(
      "Other writer"
    );
  });

  it("fails safely on IndexedDB quota or transaction failure", async () => {
    const cache = makeHarness();
    cache.memory.failWrites = true;
    expect(
      await cache.save("account-A", stateFor("Amina"), 1, true, null)
    ).toEqual({ kind: "unavailable" });
    expect(cache.memory.entries.size).toBe(0);
  });

  it("rechecks identity after an asynchronous read before returning private state", async () => {
    const cache = makeHarness();
    await cache.save("account-A", stateFor("Amina"), 1, true, null);
    cache.memory.onRead = () => cache.setIdentity("account-B");
    expect(await cache.read("account-A")).toEqual({ kind: "denied" });
  });

  it("aborts migration when the authenticated account changes before write", async () => {
    const cache = makeHarness();
    expect(
      await cache.migrateReadOnlyLegacy("account-A", async () => {
        cache.setIdentity("account-B");
        return {
          json: JSON.stringify(stateFor("Amina")),
          revision: 0,
          pending: true,
        };
      })
    ).toEqual({ kind: "denied" });
    expect(cache.memory.entries.size).toBe(0);
  });

  it("never deletes data for another account when clearing a scoped record", async () => {
    const cache = makeHarness();
    await cache.save("account-A", stateFor("Amina"), 0, true, null);
    cache.setIdentity("account-B");
    await cache.save("account-B", stateFor("Kojo"), 0, true, null);
    expect(await cache.clearAccount("account-A")).toBe("denied");
    expect(await cache.clearAccount("account-B")).toBe("cleared");
    cache.setIdentity("account-A");
    expect(await cache.read("account-A")).toMatchObject({ kind: "ready" });
    expect(cache.memory.entries.size).toBe(1);
  });

  it("does not write anything for signed-out access", async () => {
    const cache = makeHarness();
    cache.setIdentity(null);
    expect(
      await cache.save("account-A", stateFor("Amina"), 0, true, null)
    ).toEqual({ kind: "denied" });
    expect(cache.memory.entries.size).toBe(0);
  });
});
