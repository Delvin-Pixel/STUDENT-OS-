import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./materialUploadMetadata", () => ({
  reconcileMaterialUploadMetadata: vi.fn(),
}));

import { emptyState } from "../client/src/lib/storage";
import { getDb } from "./db";
import { reconcileMaterialUploadMetadata } from "./materialUploadMetadata";
import { clearWorkspace, setWorkspace } from "./workspace";

describe("revisioned material workspace lifecycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reconciles quota metadata only after a revision-matched workspace save persists the material key", async () => {
    const chain = {
      set: vi.fn(),
      where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
    };
    chain.set.mockReturnValue(chain);
    const db = { update: vi.fn().mockReturnValue(chain) };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const state = emptyState();
    state.studyMaterials = [
      {
        id: "material-1",
        title: "Waves",
        subject: "Physics",
        fileName: "waves.pdf",
        mimeType: "application/pdf",
        storageKey: "account/study-materials/waves.pdf",
        url: "",
        sizeBytes: 12,
        addedAt: "2026-08-23T00:00:00.000Z",
      },
    ];
    const workspace = JSON.stringify(state);
    await expect(setWorkspace("account", workspace, 7)).resolves.toMatchObject({
      ok: true,
      revision: 8,
    });
    expect(reconcileMaterialUploadMetadata).toHaveBeenCalledWith(
      "account",
      workspace
    );
  });

  it("reconciles an empty material-key set only after a revision-matched cloud clear/reset succeeds", async () => {
    const chain = {
      set: vi.fn(),
      where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
    };
    chain.set.mockReturnValue(chain);
    const db = {
      update: vi.fn().mockReturnValue(chain),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                workspace: null,
                revision: 9,
                schemaVersion: 4,
                updatedAt: null,
              },
            ]),
          }),
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    await expect(clearWorkspace("account")).resolves.toMatchObject({
      ok: true,
      revision: 10,
    });
    expect(reconcileMaterialUploadMetadata).toHaveBeenCalledWith(
      "account",
      JSON.stringify({ studyMaterials: [] })
    );
  });
});
