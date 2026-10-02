import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./pushDb.ts", import.meta.url)),
  "utf8"
);

describe("server device reminder replacement atomicity", () => {
  it("keeps ownership lookup, pending-plan deletion, and replacement insertion in one transaction", () => {
    expect(source).toContainSource("await db.transaction(async (tx) => {");
    expect(source).toContainSource("tx.select().from(pushDevices)");
    expect(source).toContainSource("await tx.delete(pushReminders)");
    expect(source).toContainSource("await tx.insert(pushReminders).values");
    expect(source).not.toContainSource(
      "await db.delete(pushReminders).where(and(eq(pushReminders.deviceId, device.id)"
    );
  });
});
