import { afterEach, describe, expect, it } from "vitest";
import { upsertUser } from "./db";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env["DATABASE_URL"] = originalDatabaseUrl;
});

describe("B58.1 account persistence fail-closed behavior", () => {
  it("rejects sign-in account writes when DATABASE_URL is absent", async () => {
    delete process.env.DATABASE_URL;
    await expect(
      upsertUser({
        openId: "student-without-db",
        name: "Learner",
      })
    ).rejects.toThrow("Account persistence is unavailable");
  });

  it("rejects an empty subject before attempting database writes", async () => {
    delete process.env.DATABASE_URL;
    await expect(upsertUser({ openId: "" })).rejects.toThrow(
      "User openId is required"
    );
  });
});
