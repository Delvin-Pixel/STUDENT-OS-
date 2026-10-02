import { describe, expect, it } from "vitest";
import { activeServiceWorkerPath } from "./serviceWorkerRoute";

describe("non-static service-worker route", () => {
  it("resolves the deployable worker source rather than a generated placeholder", () => {
    expect(activeServiceWorkerPath()).toMatch(/sw\.js$/);
  });
});
