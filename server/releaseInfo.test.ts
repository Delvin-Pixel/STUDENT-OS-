import { describe, expect, it, vi } from "vitest";
import { getReleaseInfo } from "./releaseInfo";

describe("release info", () => {
  it("exposes only safe release metadata", () => {
    const previous = {
      vercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID,
      vercelSha: process.env.VERCEL_GIT_COMMIT_SHA,
      databaseUrl: process.env.DATABASE_URL,
    };
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dep-123");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123");
    vi.stubEnv("DATABASE_URL", "mysql://secret@example");

    const info = getReleaseInfo();
    expect(info.deploymentId).toBe("dep-123");
    expect(info.commitSha).toBe("abc123");
    expect(JSON.stringify(info)).not.toContain("mysql://secret");

    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) vi.unstubAllEnvs();
      else if (key === "vercelDeploymentId")
        vi.stubEnv("VERCEL_DEPLOYMENT_ID", value);
      else if (key === "vercelSha") vi.stubEnv("VERCEL_GIT_COMMIT_SHA", value);
      else if (key === "databaseUrl") vi.stubEnv("DATABASE_URL", value);
    }
  });

  it("rejects oversized deployment metadata", () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "x".repeat(129));
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "y".repeat(65));
    const info = getReleaseInfo();
    expect(info.deploymentId).toBeNull();
    expect(info.commitSha).toBeNull();
  });
});
