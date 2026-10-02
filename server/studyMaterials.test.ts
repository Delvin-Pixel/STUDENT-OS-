import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import * as storage from "./storage";
import {
  studyMaterialUploadSchema,
  uploadStudyMaterial,
} from "./studyMaterials";

const pdfDataUrl = "data:application/pdf;base64,JVBERi0xLjQ=";
const input = {
  title: "Chapter",
  subject: "Physics",
  fileName: "Chapter One.pdf",
  dataUrl: pdfDataUrl,
};

function uploadDb(options?: {
  existing?: unknown[];
  quotaAffectedRows?: number;
}) {
  const db = { execute: vi.fn() };
  db.execute
    .mockResolvedValueOnce([options?.existing ?? []])
    .mockResolvedValueOnce([{ affectedRows: 1 }])
    .mockResolvedValueOnce([{ affectedRows: options?.quotaAffectedRows ?? 1 }])
    .mockResolvedValueOnce([{ affectedRows: 1 }])
    .mockResolvedValue([{ affectedRows: 1 }]);
  return db;
}

describe("study material upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(uploadDb() as never);
  });

  it("accepts only a bounded supported data URL", () => {
    expect(studyMaterialUploadSchema.parse(input).title).toBe("Chapter");
    expect(() =>
      studyMaterialUploadSchema.parse({
        ...input,
        fileName: "chapter.docx",
        dataUrl: "data:application/msword;base64,QQ==",
      })
    ).toThrow();
  });

  it("stores material beneath the authenticated account path after a durable quota reservation", async () => {
    vi.spyOn(storage, "storagePut").mockResolvedValue({
      key: "alice/study-materials/chapter_hash.pdf",
      url: "/storage/alice/study-materials/chapter_hash.pdf",
    });
    const uploaded = await uploadStudyMaterial("alice", input);
    expect(uploaded.mimeType).toBe("application/pdf");
    expect(storage.storagePut).toHaveBeenCalledWith(
      expect.stringContaining("alice/study-materials/"),
      expect.any(Buffer),
      "application/pdf"
    );
  });

  it("returns a previously stored matching file without consuming storage or uploading duplicate bytes", async () => {
    vi.spyOn(storage, "storageGetSignedUrl").mockResolvedValue(
      "https://storage.example.test/signed-prior.pdf"
    );
    vi.mocked(getDb).mockResolvedValue(
      uploadDb({
        existing: [
          {
            storageKey: "alice/study-materials/prior.pdf",
            sizeBytes: 12,
            mimeType: "application/pdf",
            status: "stored",
          },
        ],
      }) as never
    );
    const uploaded = await uploadStudyMaterial("alice", input);
    expect(uploaded.key).toBe("alice/study-materials/prior.pdf");
    expect(storage.storageGetSignedUrl).toHaveBeenCalledWith(
      "alice/study-materials/prior.pdf"
    );
    expect(storage.storagePut).not.toHaveBeenCalled();
  });

  it("rejects a request before storage when durable account quota is exhausted", async () => {
    vi.mocked(getDb).mockResolvedValue(
      uploadDb({ quotaAffectedRows: 0 }) as never
    );
    await expect(uploadStudyMaterial("alice", input)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
    expect(storage.storagePut).not.toHaveBeenCalled();
  });

  it("reports a safe gateway failure and rolls back the reservation when storage is temporarily unavailable", async () => {
    const db = uploadDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.spyOn(storage, "storagePut").mockRejectedValueOnce(
      new Error("network offline")
    );
    await expect(uploadStudyMaterial("alice", input)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
    expect(db.execute).toHaveBeenCalledTimes(6);
  });
});
