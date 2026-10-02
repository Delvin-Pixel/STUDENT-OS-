const RUNTIME_USER_INFO_KEY = "studentos-runtime-user-info";

type StorageLike = Pick<Storage, "removeItem" | "setItem">;

/** The runtime mirror is not application state; never leave a prior account's PII behind on a shared browser. */
export function syncMirroredAuthIdentity(
  user: unknown,
  storage: StorageLike = localStorage
) {
  if (!user) {
    storage.removeItem(RUNTIME_USER_INFO_KEY);
    return;
  }
  storage.setItem(RUNTIME_USER_INFO_KEY, JSON.stringify(user));
}

export { RUNTIME_USER_INFO_KEY };
