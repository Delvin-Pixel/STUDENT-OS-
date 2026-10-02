import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("service-worker compatibility routes", () => {
  const source = readFileSync(
    resolve(process.cwd(), "server/serviceWorkerRoute.ts"),
    "utf8"
  );

  it("keeps the current and recent worker generations reachable during upgrades", () => {
    for (const version of ["v15", "v14", "v13", "v12", "v11", "v10", "v9"]) {
      expect(source).toContain(`/api/service-worker-${version}.js`);
    }
  });
});
