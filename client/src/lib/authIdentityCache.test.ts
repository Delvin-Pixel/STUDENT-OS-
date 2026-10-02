import { describe, expect, it } from "vitest";
import {
  RUNTIME_USER_INFO_KEY,
  syncMirroredAuthIdentity,
} from "./authIdentityCache";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("mirrored runtime identity cache", () => {
  it("removes a prior account identity when authentication ends on a shared browser", () => {
    const storage = memoryStorage();
    syncMirroredAuthIdentity(
      { openId: "account-a", name: "Amina", email: "amina@example.test" },
      storage
    );
    expect(storage.values.get(RUNTIME_USER_INFO_KEY)).toContain("Amina");
    syncMirroredAuthIdentity(null, storage);
    expect(storage.values.has(RUNTIME_USER_INFO_KEY)).toBe(false);
  });
});
