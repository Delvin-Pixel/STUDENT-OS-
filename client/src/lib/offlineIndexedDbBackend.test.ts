import { describe, expect, it } from "vitest";
import {
  createIndexedDbOfflineBackend,
  OFFLINE_IDB_DATABASE,
  OFFLINE_IDB_STORE,
  OFFLINE_IDB_VERSION,
  type OfflineStoredRecord,
} from "./offlineIndexedDbBackend";

function record(accountId: string, digest: string): OfflineStoredRecord {
  return {
    accountId,
    cacheVersion: 1,
    workspaceSchemaVersion: 4,
    revision: 0,
    pending: true,
    savedAt: "2026-10-26T17:00:00.000Z",
    json: "{}",
    sha256: digest.repeat(64),
  };
}

/**
 * Minimal asynchronous IDB protocol harness: exercises actual IndexedDB
 * transaction/open callbacks without introducing package-lock dependencies.
 * This is NOT a substitute for an installed Chrome/Android PWA test.
 */
function mockFactory() {
  const rows = new Map<string, unknown>();
  const names = new Set<string>();
  let version = 0;
  let created = 0;
  let transactions = 0;

  const database = {
    objectStoreNames: { contains: (name: string) => names.has(name) },
    createObjectStore(name: string, options: { keyPath: string }) {
      expect(options.keyPath).toBe("accountId");
      names.add(name);
      created++;
      return {};
    },
    onversionchange: null as (() => void) | null,
    close() {},
    transaction(name: string, mode: IDBTransactionMode) {
      expect(name).toBe(OFFLINE_IDB_STORE);
      transactions++;
      const tx = {
        oncomplete: null as (() => void) | null,
        onabort: null as (() => void) | null,
        onerror: null,
        error: null,
        abort() {
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore(_name: string) {
          return {
            get(key: string) {
              const request = {
                result: undefined as unknown,
                onsuccess: null as (() => void) | null,
              };
              queueMicrotask(() => {
                request.result = rows.get(key);
                request.onsuccess?.();
                queueMicrotask(() => tx.oncomplete?.());
              });
              return request;
            },
            put(value: OfflineStoredRecord) {
              expect(mode).toBe("readwrite");
              rows.set(value.accountId, structuredClone(value));
            },
            delete(key: string) {
              expect(mode).toBe("readwrite");
              rows.delete(key);
              queueMicrotask(() => tx.oncomplete?.());
            },
          };
        },
      };
      return tx;
    },
  };

  const factory = {
    open(dbName: string, desiredVersion: number) {
      expect(dbName).toBe(OFFLINE_IDB_DATABASE);
      expect(desiredVersion).toBe(OFFLINE_IDB_VERSION);
      const request = {
        result: database,
        error: null,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onblocked: null as (() => void) | null,
      };
      queueMicrotask(() => {
        if (version === 0) {
          version = desiredVersion;
          request.onupgradeneeded?.();
        }
        request.onsuccess?.();
      });
      return request;
    },
  };
  return {
    factory: factory as unknown as IDBFactory,
    rows,
    stats: () => ({ created, transactions }),
  };
}

describe("B64.2 native IndexedDB transport contract", () => {
  it("creates one schema, atomically inserts, reads and scopes deletion", async () => {
    const mock = mockFactory();
    const backend = createIndexedDbOfflineBackend(mock.factory);
    const a = record("account-A", "a");
    const b = record("account-B", "b");
    expect(await backend.compareAndSwap("account-A", null, a)).toBe(true);
    expect(await backend.compareAndSwap("account-B", null, b)).toBe(true);
    expect(await backend.get("account-A")).toEqual(a);
    expect(await backend.get("account-B")).toEqual(b);
    expect(mock.stats().created).toBe(1);
    await backend.remove("account-A");
    expect(await backend.get("account-A")).toBeUndefined();
    expect(await backend.get("account-B")).toEqual(b);
    expect(mock.stats().transactions).toBeGreaterThanOrEqual(5);
  });

  it("refuses conflicting or stale compare-and-swap writes in one transaction", async () => {
    const mock = mockFactory();
    const backend = createIndexedDbOfflineBackend(mock.factory);
    const original = record("account-A", "a");
    const updated = record("account-A", "b");
    expect(await backend.compareAndSwap("account-A", null, original)).toBe(
      true
    );
    expect(await backend.compareAndSwap("account-A", null, updated)).toBe(
      false
    );
    expect(
      await backend.compareAndSwap("account-A", "c".repeat(64), updated)
    ).toBe(false);
    expect(
      await backend.compareAndSwap("account-A", "a".repeat(64), updated)
    ).toBe(true);
    expect(await backend.get("account-A")).toEqual(updated);
  });

  it("does not permit a record key to change across authenticated scopes", async () => {
    const mock = mockFactory();
    const backend = createIndexedDbOfflineBackend(mock.factory);
    const forged = record("account-B", "c");
    expect(
      await backend.compareAndSwap("account-A", null, forged)
    ).toBe(false);
    expect(mock.rows.size).toBe(0);
  });

  it("surfaces blocked IndexedDB upgrades instead of masking them", async () => {
    const factory = {
      open() {
        const request = {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null as (() => void) | null,
        };
        queueMicrotask(() => request.onblocked?.());
        return request;
      },
    } as unknown as IDBFactory;
    const backend = createIndexedDbOfflineBackend(factory);
    await expect(backend.get("account-A")).rejects.toThrow(
      "offline_cache_upgrade_blocked"
    );
  });
});
