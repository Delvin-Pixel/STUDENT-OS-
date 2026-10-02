import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Settings.tsx", import.meta.url)),
  "utf8"
);

describe("Custom reminder creation integrity", () => {
  it("claims valid new reminders before canonical creation and releases only for a later edited form", () => {
    expect(source).toContain(
      "const customReminderSaveClaimRef = useRef(false);"
    );
    expect(source).toMatch(
      /if \(reminderTitle \|\| reminderMessage\)[\s\S]*customReminderSaveClaimRef\.current = false;/
    );
    expect(source).toContain("if (customReminderSaveClaimRef.current) return;");
    expect(source).toContain("customReminderSaveClaimRef.current = true;");
    expect(source).toContain(
      "if (addCustomReminder(reminder)) clearCustomReminderForm();"
    );
    expect(source).toContain(
      "else customReminderSaveClaimRef.current = false;"
    );
  });
});
