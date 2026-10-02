import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearState,
  emptyState,
  exportData,
  importData,
  loadState,
  loadWorkspaceRecovery,
  parseImportData,
  saveState,
} from "./storage";

function makeStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  };
}

describe("Student OS backup data", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips a valid student workspace while preserving required current fields", () => {
    const original = emptyState();
    original.profile = {
      name: "Amina",
      age: 16,
      studentType: "Secondary School",
      educationLevel: "Secondary",
      goals: ["Prepare for exams"],
      subjects: ["Mathematics"],
      hoursPerDay: "2 hours",
    };
    original.onboarded = true;
    original.xp = 75;
    original.settings.currency = "NGN";
    original.aiAnswerRatings.push({
      answerId: "lesson-answer-1",
      surface: "lesson",
      rating: "down",
      answerPreview: "A quadratic equation has degree two.",
      reason: "needs_example",
      ratedAt: "2026-08-22T12:00:00.000Z",
    });
    original.customReminders.push({
      id: "reminder-1",
      title: "Plan tomorrow",
      message: "Choose one next step.",
      date: "",
      time: "18:00",
      repeat: "daily",
      enabled: true,
      createdAt: "2026-08-13T00:00:00.000Z",
    });
    original.notes.push({
      id: "note-1",
      title: "Quadratic formula",
      subject: "Mathematics",
      content: "x = (-b ± √(b² − 4ac)) / 2a",
      pinned: true,
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
    });

    const restored = importData(exportData(original));

    expect(restored).toMatchObject({
      onboarded: true,
      xp: 75,
      settings: { currency: "NGN" },
      profile: { name: "Amina", subjects: ["Mathematics"] },
      notes: [
        expect.objectContaining({ title: "Quadratic formula", pinned: true }),
      ],
      customReminders: [
        expect.objectContaining({ title: "Plan tomorrow", repeat: "daily" }),
      ],
      aiAnswerRatings: [
        expect.objectContaining({
          answerId: "lesson-answer-1",
          rating: "down",
          answerPreview: "A quadratic equation has degree two.",
          reason: "needs_example",
        }),
      ],
    });
  });

  it("exports portable backup metadata and strips short-lived signed material URLs", () => {
    const original = emptyState();
    original.studyMaterials.push({
      id: "material-1",
      title: "Circuits",
      subject: "Physics",
      fileName: "circuits.pdf",
      mimeType: "application/pdf",
      storageKey: "account/study-materials/circuits.pdf",
      url: "https://signed.example/temporary-token",
      sizeBytes: 123,
      addedAt: "2026-08-30T00:00:00.000Z",
    });

    const exported = exportData(original);
    const envelope = JSON.parse(exported) as {
      format: string;
      backupFormatVersion: number;
      data: { studyMaterials: Array<{ url: string; storageKey: string }> };
    };

    expect(envelope.format).toBe("student-os-backup");
    expect(envelope.backupFormatVersion).toBe(2);
    expect(envelope.data.studyMaterials[0]).toMatchObject({
      url: "",
      storageKey: "account/study-materials/circuits.pdf",
    });
    expect(exported).not.toContain("temporary-token");
  });

  it("rejects unsupported future backup format versions", () => {
    expect(
      parseImportData(
        JSON.stringify({
          format: "student-os-backup",
          backupFormatVersion: 999,
          data: emptyState(),
        })
      )
    ).toEqual({ state: null, reason: "invalid_schema" });
  });

  it("rejects malformed backup data with an explicit reason", () => {
    expect(parseImportData("not valid JSON")).toEqual({
      state: null,
      reason: "invalid_json",
    });
    expect(importData("not valid JSON")).toBeNull();
  });

  it("rejects oversized backup files before attempting a workspace import", () => {
    const oversized = `{"blob":"${"x".repeat(4 * 1024 * 1024)}"}`;
    expect(parseImportData(oversized)).toEqual({
      state: null,
      reason: "too_large",
    });
    expect(importData(oversized)).toBeNull();
  });

  it("drops expired or copied signed URLs during import while preserving storage references", () => {
    const restored = importData(
      JSON.stringify({
        ...emptyState(),
        studyMaterials: [
          {
            id: "material-1",
            title: "Circuits",
            subject: "Physics",
            fileName: "circuits.pdf",
            mimeType: "application/pdf",
            storageKey: "account/study-materials/circuits.pdf",
            url: "https://signed.example/already-expired",
            sizeBytes: 123,
            addedAt: "2026-08-30T00:00:00.000Z",
          },
        ],
      })
    );

    expect(restored?.studyMaterials[0]).toMatchObject({
      storageKey: "account/study-materials/circuits.pdf",
      url: "",
    });
  });

  it("keeps older ratings that predate answer previews without inventing stored content", () => {
    const restored = importData(
      JSON.stringify({
        ...emptyState(),
        aiAnswerRatings: [
          {
            answerId: "legacy",
            surface: "assistant",
            rating: "up",
            ratedAt: "2026-08-20T12:00:00.000Z",
          },
        ],
      })
    );
    expect(restored?.aiAnswerRatings).toEqual([
      expect.objectContaining({ answerId: "legacy", answerPreview: "" }),
    ]);
  });

  it("adds empty deletion metadata when a legacy browser cache predates tombstones", () => {
    const legacy = emptyState() as unknown as Record<string, unknown>;
    delete legacy.syncTombstones;
    const restored = importData(JSON.stringify(legacy));
    expect(restored?.syncTombstones).toEqual([]);
  });

  it("drops invalid reasons and reasons attached to helpful ratings during import", () => {
    const restored = importData(
      JSON.stringify({
        ...emptyState(),
        aiAnswerRatings: [
          {
            answerId: "helpful",
            surface: "assistant",
            rating: "up",
            reason: "too_vague",
            ratedAt: "2026-08-20T12:00:00.000Z",
          },
          {
            answerId: "invalid",
            surface: "lesson",
            rating: "down",
            reason: "free text",
            ratedAt: "2026-08-20T12:01:00.000Z",
          },
        ],
      })
    );
    expect(restored?.aiAnswerRatings.map(rating => rating.answerId)).toEqual([
      "helpful",
      "invalid",
    ]);
    expect(restored?.aiAnswerRatings[0]).not.toHaveProperty("reason");
    expect(restored?.aiAnswerRatings[1]).not.toHaveProperty("reason");
  });

  it("starts once from clean onboarding when a pre-no-sign-in Chrome workspace is present", () => {
    localStorage.setItem(
      "studentos:data:v2",
      JSON.stringify({
        ...emptyState(),
        onboarded: true,
        profile: {
          name: "Old student",
          studentType: "Secondary",
          educationLevel: "Secondary",
          goals: [],
          subjects: [],
          hoursPerDay: "1 hour",
        },
      })
    );
    localStorage.setItem("studentos:workspace-owner:v1", "legacy-account");

    const state = loadState();

    expect(state.profile).toBeNull();
    expect(state.onboarded).toBe(false);
    expect(localStorage.getItem("studentos:data:v2")).toBeNull();
    expect(localStorage.getItem("studentos:workspace-owner:v1")).toBeNull();
  });

  it("keeps device-local workspaces isolated by authenticated account", () => {
    const amina = emptyState();
    amina.profile = {
      name: "Amina",
      studentType: "Secondary School",
      educationLevel: "Secondary",
      goals: [],
      subjects: [],
      hoursPerDay: "2 hours",
    };
    const kojo = emptyState();
    kojo.profile = {
      name: "Kojo",
      studentType: "University",
      educationLevel: "Tertiary",
      goals: [],
      subjects: [],
      hoursPerDay: "1 hour",
    };
    expect(saveState(amina, "openid:amina")).toBe(true);
    expect(saveState(kojo, "openid:kojo")).toBe(true);
    expect(loadState("openid:amina").profile?.name).toBe("Amina");
    expect(loadState("openid:kojo").profile?.name).toBe("Kojo");
    expect(loadState("openid:new-student").profile).toBeNull();
  });

  it("reports a safe failure instead of throwing when cache clearing is blocked by the browser", () => {
    vi.stubGlobal("localStorage", {
      removeItem: () => {
        throw new Error("storage disabled");
      },
    });
    expect(clearState("openid:amina")).toBe(false);
  });

  it("preserves a bounded raw snapshot and recovery marker when account-local JSON is corrupt", () => {
    const raw = "{not-json";
    localStorage.setItem("studentos:workspace:v4:openid%3Arecovery", raw);
    const state = loadState("openid:recovery");
    expect(state.profile).toBeNull();
    expect(loadWorkspaceRecovery("openid:recovery")).toMatchObject({
      reason: "invalid_json",
      rawSnapshot: raw,
    });
  });

  it("records schema corruption separately from an empty new-account cache", () => {
    localStorage.setItem(
      "studentos:workspace:v4:openid%3Aschema",
      JSON.stringify({
        ...emptyState(),
        settings: { ...emptyState().settings, theme: "invalid" },
      })
    );
    expect(loadState("openid:schema").profile).toBeNull();
    expect(loadWorkspaceRecovery("openid:schema")).toMatchObject({
      reason: "invalid_schema",
    });
  });
});
