import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { emptyState } from "../client/src/lib/storage";
import { getDb } from "./db";
import {
  clearWorkspace,
  getWorkspace,
  MAX_WORKSPACE_BYTES,
  setWorkspace,
  validateWorkspacePayload,
} from "./workspace";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateWorkspacePayload", () => {
  it("accepts a complete canonical workspace payload", () => {
    const result = validateWorkspacePayload({ ...emptyState(), xp: 5 });
    if (!result.ok) throw new Error(result.reason);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toContain('"xp":5');
  });

  it("downgrades client-controlled transition provenance before cloud persistence", () => {
    const state = emptyState();
    state.transitionDecisionHub = {
      sourceStage: "SHS",
      targetStage: "Tertiary",
      status: "preparing",
      results: [],
      aggregateConfidence: "official",
      options: [
        {
          id: "forged-official",
          name: "Forged option",
          type: "programme",
          confidence: "official",
          sourceUrl: "https://example.edu/requirements",
          sourceVerifiedAt: "2026-09-27T00:00:00Z",
          requiredSubjects: [],
        },
        {
          id: "forged-secondary",
          name: "Forged secondary",
          type: "programme",
          confidence: "verified_secondary",
          sourceUrl: "https://example.edu/secondary",
          sourceVerifiedAt: "2026-09-27T00:00:00Z",
          requiredSubjects: [],
        },
      ],
      preparationTasks: [],
      lastUpdatedAt: "2026-09-27T00:00:00Z",
    };

    const result = validateWorkspacePayload(state);
    if (!result.ok) throw new Error(result.reason);
    const stored = JSON.parse(result.text);
    expect(stored.transitionDecisionHub.aggregateConfidence).toBe("unverified");
    expect(
      stored.transitionDecisionHub.options.map(
        (option: { confidence: string }) => option.confidence
      )
    ).toEqual(["learner_entered", "learner_entered"]);
    expect(
      stored.transitionDecisionHub.options.every(
        (option: { sourceVerifiedAt?: string }) =>
          option.sourceVerifiedAt === undefined
      )
    ).toBe(true);
  });

  it("strips device-private AI feedback from every cloud workspace write", () => {
    const state = emptyState();
    state.aiAnswerRatings.push({
      answerId: "answer-1",
      surface: "assistant",
      rating: "down",
      answerPreview: "Private reflection",
      reason: "too_vague",
      ratedAt: "2026-08-23T00:00:00.000Z",
    });
    const result = validateWorkspacePayload(state);
    if (!result.ok) throw new Error(result.reason);
    expect(JSON.parse(result.text).aiAnswerRatings).toEqual([]);
  });

  it("normalizes a legacy cloud workspace that predates the currency preference", () => {
    const legacy = emptyState() as unknown as {
      settings: Record<string, unknown>;
    };
    delete legacy.settings.currency;
    const result = validateWorkspacePayload(legacy);
    if (!result.ok) throw new Error(result.reason);
    const restored = JSON.parse(result.text) as {
      settings: { currency: string };
    };
    expect(restored.settings.currency).toBe("GHS");
  });

  it("normalizes a legacy cloud workspace that predates the P0 connected-learning collections", () => {
    const legacy = emptyState() as unknown as Record<string, unknown>;
    delete legacy.topics;
    delete legacy.learningEvidence;
    delete legacy.studyPlans;
    delete legacy.quizzes;
    delete legacy.quizAttempts;
    const result = validateWorkspacePayload(legacy);
    if (!result.ok) throw new Error(result.reason);
    const restored = JSON.parse(result.text) as Pick<
      typeof legacy,
      "topics" | "learningEvidence" | "studyPlans" | "quizzes" | "quizAttempts"
    >;
    expect(restored).toMatchObject({
      topics: [],
      learningEvidence: [],
      studyPlans: [],
      quizzes: [],
      quizAttempts: [],
    });
  });

  it("normalizes a legacy cloud workspace that predates deletion tombstones", () => {
    const legacy = emptyState() as unknown as Record<string, unknown>;
    delete legacy.syncTombstones;
    const result = validateWorkspacePayload(legacy);
    if (!result.ok) throw new Error(result.reason);
    expect(JSON.parse(result.text).syncTombstones).toEqual([]);
  });

  it("accepts a valid canonical payload near the conservative 4 MiB application cap", () => {
    const nearLimit = emptyState();
    nearLimit.notes = Array.from({ length: 185 }, (_, index) => ({
      id: `near-limit-note-${index}`,
      title: "Capacity evidence",
      subject: "Systems",
      content: "x".repeat(20_000),
      pinned: false,
      createdAt: "2026-08-23T00:00:00.000Z",
      updatedAt: "2026-08-23T00:00:00.000Z",
    }));
    const result = validateWorkspacePayload(nearLimit);
    if (!result.ok) throw new Error(result.reason);
    expect(Buffer.byteLength(result.text, "utf8")).toBeGreaterThan(
      3.5 * 1024 * 1024
    );
    expect(Buffer.byteLength(result.text, "utf8")).toBeLessThan(
      MAX_WORKSPACE_BYTES
    );
  });

  it("rejects non-object primitives", () => {
    expect(validateWorkspacePayload("oops").ok).toBe(false);
    expect(validateWorkspacePayload(42).ok).toBe(false);
    expect(validateWorkspacePayload(null).ok).toBe(false);
  });

  it("rejects schema-valid payloads over the 4 MiB application guard", () => {
    const huge = emptyState();
    huge.notes = Array.from({ length: 220 }, (_, index) => ({
      id: `over-limit-note-${index}`,
      title: "Capacity evidence",
      subject: "Systems",
      content: "x".repeat(20_000),
      pinned: false,
      createdAt: "2026-08-23T00:00:00.000Z",
      updatedAt: "2026-08-23T00:00:00.000Z",
    }));
    const result = validateWorkspacePayload(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("too large");
  });

  it("rejects malformed records and unknown fields before they can be persisted", () => {
    const malformed = {
      ...emptyState(),
      tasks: [
        {
          id: "bad",
          title: "Bad",
          description: "",
          subject: "Math",
          dueDate: "",
          priority: "medium",
          status: "not-a-status",
          createdAt: "2026-08-23",
        },
      ],
      unexpected: true,
    };
    const result = validateWorkspacePayload(malformed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("workspace does not match");
  });

  it("rejects unserializable values", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(validateWorkspacePayload(cyclic).ok).toBe(false);
  });
});

describe("per-user workspace isolation", () => {
  const makeDb = (rows: unknown[]) => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(rows) })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    })),
  });

  it("returns an empty workspace for a brand-new account", async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb([]) as never);
    const record = await getWorkspace("openid:new-user");
    expect(record.workspace).toBeNull();
  });

  it("reads only the requested user's workspace", async () => {
    const db = makeDb([{ workspace: '{"xp":42}', updatedAt: new Date() }]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    const record = await getWorkspace("openid:alice");
    expect(record.workspace).toBe('{"xp":42}');
    expect(db.select).toHaveBeenCalled();
  });

  it("writes only to the requested user's row", async () => {
    const db = makeDb([]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    await setWorkspace("openid:bob", '{"tasks":[1]}', 0);
    expect(db.update).toHaveBeenCalled();
  });

  it("clears only the requested user's workspace", async () => {
    const db = makeDb([]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    await clearWorkspace("openid:bob");
    expect(db.update).toHaveBeenCalled();
  });

  it("degrades gracefully when the database is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    const record = await getWorkspace("openid:anyone");
    expect(record.workspace).toBeNull();
    await setWorkspace("openid:anyone", '{"x":1}', 0);
    // no throw — persistence warnings are logged instead
  });
});
