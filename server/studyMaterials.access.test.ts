import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storageGetSignedUrl: vi.fn(),
  storagePut: vi.fn(),
}));
vi.mock("./workspace", () => ({
  getWorkspace: vi.fn(),
  validateWorkspacePayload: vi.fn(),
}));

import { storageGetSignedUrl } from "./storage";
import { resolveOwnedStudyMaterialUrl } from "./studyMaterials";
import { getWorkspace, validateWorkspacePayload } from "./workspace";

const workspace = {
  studyMaterials: [{ storageKey: "alice/study-materials/a.pdf" }],
};

describe("study-material access ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWorkspace).mockResolvedValue({
      openId: "alice",
      workspace: JSON.stringify(workspace),
      revision: 1,
      schemaVersion: 1,
      updatedAt: null,
    });
    vi.mocked(validateWorkspacePayload).mockReturnValue({
      ok: true,
      text: JSON.stringify(workspace),
    });
    vi.mocked(storageGetSignedUrl).mockResolvedValue(
      "https://signed.example/a.pdf"
    );
  });

  it("returns a signed URL for material recorded in the authenticated workspace", async () => {
    await expect(
      resolveOwnedStudyMaterialUrl("alice", "alice/study-materials/a.pdf")
    ).resolves.toEqual({ url: "https://signed.example/a.pdf" });
    expect(storageGetSignedUrl).toHaveBeenCalledWith(
      "alice/study-materials/a.pdf"
    );
  });

  it("rejects a key that is absent from the authenticated workspace before storage is contacted", async () => {
    vi.mocked(getWorkspace).mockResolvedValueOnce({
      openId: "bob",
      workspace: JSON.stringify({ studyMaterials: [] }),
      revision: 1,
      schemaVersion: 1,
      updatedAt: null,
    });
    vi.mocked(validateWorkspacePayload).mockReturnValueOnce({
      ok: true,
      text: JSON.stringify({ studyMaterials: [] }),
    });
    await expect(
      resolveOwnedStudyMaterialUrl("bob", "alice/study-materials/a.pdf")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storageGetSignedUrl).not.toHaveBeenCalled();
  });
});
