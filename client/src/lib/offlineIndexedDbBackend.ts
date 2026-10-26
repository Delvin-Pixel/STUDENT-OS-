/**
 * B64.2 IndexedDB implementation only; never opened without an explicit call.
 * The application remains on its existing, independent localStorage path.
 */
export const OFFLINE_IDB_DATABASE = "studentos-offline-cache-v1";
export const OFFLINE_IDB_STORE = "account-workspaces";
export const OFFLINE_IDB_VERSION = 1;

export type OfflineStoredRecord = Readonly<{
  accountId: string;
  cacheVersion: 1;
  workspaceSchemaVersion: number;
  revision: number;
  pending: boolean;
  savedAt: string;
  json: string;
  sha256: string;
}>;

/**
 * Each operation is a single atomic database transaction. In particular,
 * compareAndSwap must not perform get + put in separate transactions.
 */
export interface OfflineCacheBackend {
  get(accountId: string): Promise<unknown | undefined>;
  compareAndSwap(
    accountId: string,
    expectedChecksum: string | null,
    next: OfflineStoredRecord
  ): Promise<boolean>;
  remove(accountId: string): Promise<void>;
}

async function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(OFFLINE_IDB_DATABASE, OFFLINE_IDB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_IDB_STORE)) {
        db.createObjectStore(OFFLINE_IDB_STORE, { keyPath: "accountId" });
      }
    };
    request.onblocked = () => {
      if (!settled) {
        settled = true;
        reject(new Error("offline_cache_upgrade_blocked"));
      }
    };
    request.onerror = () => {
      if (!settled) {
        settled = true;
        reject(request.error ?? new Error("offline_cache_open_failed"));
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

async function transaction<T>(
  factory: IDBFactory,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, setResult: (result: T) => void) => void
): Promise<T> {
  const db = await openDatabase(factory);
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(OFFLINE_IDB_STORE, mode);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    let result: T;
    let hasResult = false;
    const setResult = (next: T) => {
      result = next;
      hasResult = true;
    };
    tx.oncomplete = () => {
      db.close();
      if (!hasResult) {
        reject(new Error("offline_cache_missing_transaction_result"));
      } else {
        resolve(result);
      }
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("offline_cache_transaction_aborted"));
    };
    tx.onerror = () => {
      // onabort is the terminal failure event for a transaction.
    };
    try {
      action(tx.objectStore(OFFLINE_IDB_STORE), setResult);
    } catch {
      tx.abort();
      // Abort handles terminal settlement without disclosing stored data.
    }
  });
}

/**
 * Uses a single shared DB with account-keyed records. This is account
 * separation, not encryption or a substitute for authenticated session scope.
 */
export function createIndexedDbOfflineBackend(
  factory: IDBFactory
): OfflineCacheBackend {
  return {
    get: accountId =>
      transaction<unknown | undefined>(factory, "readonly", (store, done) => {
        const request = store.get(accountId);
        request.onsuccess = () => done(request.result as unknown);
      }),
    compareAndSwap: (accountId, expectedChecksum, next) =>
      transaction<boolean>(factory, "readwrite", (store, done) => {
        const get = store.get(accountId);
        get.onsuccess = () => {
          const previous = get.result as unknown;
          const actualChecksum =
            previous &&
            typeof previous === "object" &&
            !Array.isArray(previous) &&
            "sha256" in previous &&
            typeof previous.sha256 === "string"
              ? previous.sha256
              : null;
          const matches =
            expectedChecksum === null
              ? previous === undefined
              : actualChecksum === expectedChecksum && previous !== undefined;
          if (!matches || next.accountId !== accountId) {
            done(false);
            return;
          }
          store.put(next);
          done(true);
        };
      }),
    remove: accountId =>
      transaction<void>(factory, "readwrite", (store, done) => {
        store.delete(accountId);
        done(undefined);
      }),
  };
}
