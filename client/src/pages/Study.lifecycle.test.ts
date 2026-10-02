import "@shared/sourceAssertions";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./Study.tsx", import.meta.url)),
  "utf8"
);

describe("Study Planner session lifecycle controls", () => {
  it("uses canonical start and completion actions rather than generic status mutation", () => {
    expect(source).toContainSource("onStart={() => startSession(s.id)}");
    expect(source).toContainSource("onComplete={() => completeSession(s.id)}");
    expect(source).toContainSource('s.status === "planned" && (<Button');
    expect(source).toContainSource('s.status === "in_progress" && (<Button');
    expect(source).not.toContainSource("updateSession(s.id, { status })");
  });

  it("claims a valid manual dialog save before submitting the canonical session mutation", () => {
    expect(source).toContainSource("const saveClaimRef = useRef(false);");
    expect(source).toContainSource("saveClaimRef.current = false;");
    expect(source).toContainSource("if (saveClaimRef.current) return;");
    expect(source).toContainSource("saveClaimRef.current = true;");
    expect(source).toContainSource("const accepted = onSave({");
  });

  it("retains create and edit details when canonical overlap validation rejects the session", () => {
    expect(source).toContainSource("if (!accepted) {");
    expect(source).toContainSource("saveClaimRef.current = false;");
    expect(source).toContainSource("Your details are still here");
    expect(source).toContainSource(
      "const accepted = editing ? updateSession(editing.id, data) : addSession(data);"
    );
  });
});
