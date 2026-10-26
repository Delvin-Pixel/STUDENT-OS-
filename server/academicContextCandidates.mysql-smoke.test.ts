import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  latestAcademicContextCandidate,
  listAcademicContextCandidates,
  proposeAcademicContextCandidate,
} from "./academicContextCandidates";

/**
 * Runs only AFTER all migrations on disposable CI MySQL:
 * STUDENT_OS_CONTEXT_MYSQL_SMOKE=1 pnpm exec vitest run server/academicContextCandidates.mysql-smoke.test.ts
 *
 * Never run against a real user database or a production environment.
 */
const enabled = process.env.STUDENT_OS_CONTEXT_MYSQL_SMOKE === "1";
const url = process.env["DATABASE_URL"];
const isDisposableCi =
  process.env.CI === "true" &&
  typeof url === "string" &&
  (() => {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === "mysql:" &&
        parsed.hostname === "127.0.0.1" &&
        parsed.pathname === "/studentos_ci"
      );
    } catch {
      return false;
    }
  })();

describe.skipIf(!enabled)("B62.5 disposable MySQL account context integration", () => {
  if (!isDisposableCi)
    throw new Error(
      "Academic context MySQL smoke tests require disposable localhost CI MySQL."
    );

  const ownerA = "fixture-a-" + randomUUID();
  const ownerB = "fixture-b-" + randomUUID();
  const key = "context-" + randomUUID();
  const base = {
    countryCode: "GH" as const,
    educationLevel: "SHS" as const,
    enrollmentMode: "private_candidate" as const,
    curriculumId: "wassce-physics",
    curriculumVersion: "2026",
  };

  it("stores learner-declared preferences with immutable, non-authoritative metadata", async () => {
    const created = await proposeAcademicContextCandidate(ownerA, key, base);
    expect(created).toMatchObject({
      context: base,
      provenance: "learner_declared",
      authorityStatus: "unverified",
      academicPolicyApproved: false,
      verifiedMasteryEligible: false,
    });
    expect(created.candidateId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(created)).not.toContain(ownerA);
    expect(JSON.stringify(created)).not.toContain(key);
  });

  it("treats identical retries as idempotent without inserting new versions", async () => {
    const first = await proposeAcademicContextCandidate(ownerA, key, base);
    const retry = await proposeAcademicContextCandidate(ownerA, key, base);
    expect(retry).toEqual(first);
    const history = await listAcademicContextCandidates(ownerA);
    expect(history.filter(row => row.candidateId === first.candidateId)).toHaveLength(1);
  });

  it("rejects replayed keys with different academic data instead of overwriting", async () => {
    await expect(
      proposeAcademicContextCandidate(ownerA, key, {
        ...base,
        curriculumVersion: "2027",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await latestAcademicContextCandidate(ownerA))?.context.curriculumVersion)
      .toBe("2026");
  });

  it("isolates two student accounts even when their idempotency keys match", async () => {
    const other = await proposeAcademicContextCandidate(ownerB, key, {
      ...base,
      curriculumVersion: "2027",
    });
    expect(other.context.curriculumVersion).toBe("2027");
    expect(other.candidateId).not.toBe(
      (await latestAcademicContextCandidate(ownerA))?.candidateId
    );
    expect((await listAcademicContextCandidates(ownerA)).some(
      item => item.candidateId === other.candidateId
    )).toBe(false);
  });

  it("preserves historical candidates when a later version is proposed", async () => {
    const latest = await proposeAcademicContextCandidate(
      ownerA,
      "updated-" + randomUUID(),
      { ...base, curriculumVersion: "2028" }
    );
    const versions = await listAcademicContextCandidates(ownerA);
    expect(versions.map(version => version.context.curriculumVersion)).toEqual([
      "2028",
      "2026",
    ]);
    expect((await latestAcademicContextCandidate(ownerA))?.candidateId).toBe(
      latest.candidateId
    );
    expect(versions.every(version => version.authorityStatus === "unverified"))
      .toBe(true);
  });
});
