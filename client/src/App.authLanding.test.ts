import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./App.tsx", import.meta.url)),
  "utf8"
);

describe("authentication landing actions", () => {
  it("separates new and returning student actions while preserving one safe OAuth start handler and account-keyed workspace routing", () => {
    expect(source).toContain("New to Student OS?");
    expect(source).toContain("Create an account");
    expect(source).toContain("Already have an account?");
    expect(source).toContain("Log in");
    expect(source).toContain("Welcome to Student OS");
    expect(source).toContain('role="status"');
    expect(source).toContain("Connecting securely");
    expect(source).toContain("disabled={loginStarting}");
    expect(source).toContain("const handleLogin = async () =>");
    expect(source).toContain(
      "<StoreProvider key={user.openId} openId={user.openId}>"
    );
  });
});
