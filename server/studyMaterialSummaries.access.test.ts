import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(), listLLMModels: vi.fn() }));
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn() }));
vi.mock("./workspace", () => ({
  getWorkspace: vi.fn(),
  setWorkspace: vi.fn(),
  validateWorkspacePayload: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { storageGetSignedUrl } from "./storage";
import { generateMaterialSummary } from "./studyMaterialSummaries";
import {
  getWorkspace,
  setWorkspace,
  validateWorkspacePayload,
} from "./workspace";

const aliceKey = "account-a/study-materials/physics.pdf";
const accountAWorkspace = {
  studyMaterials: [
    {
      storageKey: aliceKey,
      mimeType: "application/pdf",
      title: "Physics",
      subject: "Physics",
    },
  ],
};
const accountBWorkspace = { studyMaterials: [] };

describe("material-summary Account A/B ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWorkspace).mockImplementation(async openId => ({
      openId,
      workspace: JSON.stringify(
        openId === "account-a" ? accountAWorkspace : accountBWorkspace
      ),
      revision: 1,
      schemaVersion: 1,
      updatedAt: null,
    }));
    vi.mocked(validateWorkspacePayload).mockImplementation(value => ({
      ok: true,
      text: JSON.stringify(value),
    }));
  });

  it("rejects Account B before a foreign Account A PDF can be persisted, signed, or sent to AI", async () => {
    await expect(
      generateMaterialSummary("account-b", aliceKey)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(setWorkspace).not.toHaveBeenCalled();
    expect(storageGetSignedUrl).not.toHaveBeenCalled();
    expect(invokeLLM).not.toHaveBeenCalled();
  });
});
