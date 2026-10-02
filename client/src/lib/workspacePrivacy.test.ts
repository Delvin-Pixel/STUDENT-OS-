import { describe, expect, it } from "vitest";
import { emptyState } from "./storage";
import {
  preserveDevicePrivateWorkspaceFields,
  projectWorkspaceForCloud,
} from "./workspacePrivacy";

describe("workspace privacy projection", () => {
  it("removes device-private feedback from a cloud payload without mutating the browser state", () => {
    const local = emptyState();
    local.aiAnswerRatings.push({
      answerId: "answer-1",
      surface: "lesson",
      rating: "up",
      answerPreview: "Private note",
      ratedAt: "2026-08-23T00:00:00.000Z",
    });
    const cloud = projectWorkspaceForCloud(local);
    expect(cloud.aiAnswerRatings).toEqual([]);
    expect(local.aiAnswerRatings).toHaveLength(1);
  });

  it("keeps this browser's private feedback when a cloud workspace is adopted", () => {
    const remote = emptyState();
    remote.aiAnswerRatings.push({
      answerId: "legacy-cloud",
      surface: "assistant",
      rating: "down",
      answerPreview: "Should not return",
      ratedAt: "2026-08-22T00:00:00.000Z",
    });
    const local = emptyState();
    local.aiAnswerRatings.push({
      answerId: "device-only",
      surface: "assistant",
      rating: "up",
      answerPreview: "Local reflection",
      ratedAt: "2026-08-23T00:00:00.000Z",
    });
    const adopted = preserveDevicePrivateWorkspaceFields(remote, local);
    expect(adopted.aiAnswerRatings.map(entry => entry.answerId)).toEqual([
      "device-only",
    ]);
  });
});
