import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));

import { emptyState } from "../client/src/lib/storage";
import { getDb } from "./db";
import { storageGetSignedUrl, storagePut } from "./storage";
import {
  resolveOwnedStudyMaterialUrl,
  uploadStudyMaterial,
} from "./studyMaterials";
import { clearWorkspace, setWorkspace } from "./workspace";

const input = {
  title: "Waves",
  subject: "Physics",
  fileName: "waves.pdf",
  dataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
};

describe("material full revisioned lifecycle contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("covers upload metadata, save, restored owned access, and clear-triggered release reconciliation in one flow", async () => {
    let restoredWorkspace = "";
    let metadataExists = true;
    let quotaBytes = 12;
    const execute = vi.fn().mockImplementation(async () => {
      const call = execute.mock.calls.length;
      if (call === 1) return [[]];
      if (call >= 2 && call <= 5) return [{ affectedRows: 1 }];
      if (call === 6)
        return [
          [
            {
              id: 1,
              storageKey: "account/study-materials/waves-hash.pdf",
              sizeBytes: 12,
              status: "stored",
            },
          ],
        ];
      if (call === 7)
        return metadataExists
          ? [
              [
                {
                  id: 1,
                  storageKey: "account/study-materials/waves-hash.pdf",
                  sizeBytes: 12,
                  status: "stored",
                },
              ],
            ]
          : [[]];
      if (call === 8) {
        metadataExists = false;
        return [{ affectedRows: 1 }];
      }
      if (call === 9) {
        quotaBytes = 0;
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    });
    const chain = {
      set: vi.fn(),
      where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
    };
    chain.set.mockReturnValue(chain);
    const db = {
      execute,
      update: vi.fn().mockReturnValue(chain),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => [
              {
                workspace: restoredWorkspace,
                revision: 2,
                schemaVersion: 4,
                updatedAt: null,
              },
            ]),
          }),
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(storagePut).mockResolvedValue({
      key: "account/study-materials/waves-hash.pdf",
      url: "/storage/account/study-materials/waves-hash.pdf",
    });
    vi.mocked(storageGetSignedUrl).mockResolvedValue(
      "https://signed.example/material"
    );

    const uploaded = await uploadStudyMaterial("account", input);
    const state = emptyState();
    state.studyMaterials = [
      {
        id: "material-1",
        title: "Waves",
        subject: "Physics",
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        storageKey: uploaded.key,
        url: "",
        sizeBytes: uploaded.sizeBytes,
        addedAt: "2026-08-23T00:00:00.000Z",
      },
    ];
    restoredWorkspace = JSON.stringify(state);
    await expect(
      setWorkspace("account", restoredWorkspace, 1)
    ).resolves.toMatchObject({ ok: true });
    await expect(
      resolveOwnedStudyMaterialUrl("account", uploaded.key)
    ).resolves.toEqual({ url: "https://signed.example/material" });
    await expect(clearWorkspace("account")).resolves.toMatchObject({
      ok: true,
    });
    expect(storagePut).toHaveBeenCalledTimes(1);
    expect(storageGetSignedUrl).toHaveBeenCalledWith(uploaded.key);
    expect(metadataExists).toBe(false);
    expect(quotaBytes).toBe(0);
  });
});
