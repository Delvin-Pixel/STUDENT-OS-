import { describe, expect, it } from "vitest";
import { SERVICE_WORKER_VERSION } from "./serviceWorkerVersion";

describe("device diagnostics contract", () => {
  it("pins diagnostics to the active service worker generation", () => {
    expect(SERVICE_WORKER_VERSION).toBe("studentos-v15");
  });
});
