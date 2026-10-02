import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { reconcileMaterialUploadMetadata } from "./materialUploadMetadata";

describe("material upload metadata reconciliation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retains a metadata key still referenced by the persisted workspace", async () => {
    const db = {
      execute: vi.fn().mockResolvedValueOnce([
        [
          {
            id: 1,
            storageKey: "account/study-materials/kept.pdf",
            sizeBytes: 12,
            status: "stored",
          },
        ],
      ]),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    await reconcileMaterialUploadMetadata(
      "account",
      JSON.stringify({
        studyMaterials: [{ storageKey: "account/study-materials/kept.pdf" }],
      }),
      new Date("2026-08-23T12:20:00.000Z")
    );
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it("releases aged metadata and quota only after the canonical workspace no longer references its private key", async () => {
    const db = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              storageKey: "account/study-materials/removed.pdf",
              sizeBytes: 12,
              status: "stored",
            },
          ],
        ])
        .mockResolvedValue({ affectedRows: 1 }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    await reconcileMaterialUploadMetadata(
      "account",
      JSON.stringify({ studyMaterials: [] }),
      new Date("2026-08-23T12:20:00.000Z")
    );
    expect(db.execute).toHaveBeenCalledTimes(3);
  });

  it("releases a stale pending reservation after the grace period so interrupted uploads cannot consume quota indefinitely", async () => {
    const db = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([
          [{ id: 2, storageKey: null, sizeBytes: 12, status: "pending" }],
        ])
        .mockResolvedValue({ affectedRows: 1 }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    await reconcileMaterialUploadMetadata(
      "account",
      JSON.stringify({ studyMaterials: [] }),
      new Date("2026-08-23T12:20:00.000Z")
    );
    expect(db.execute).toHaveBeenCalledTimes(3);
  });
});
