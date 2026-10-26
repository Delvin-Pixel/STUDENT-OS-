import { describe, expect, it } from "vitest";
import {
  preflightOfflineSync,
  type OfflinePreflightInput,
  type OfflineRecord,
  type OfflineSnapshot,
} from "./offlineSyncPreflight";

const digest = (character: string) => character.repeat(64);
const item = (
  id: string,
  character: string,
  collection: OfflineRecord["collection"] = "tasks"
): OfflineRecord => ({
  collection,
  id,
  state: "present",
  digest: digest(character),
});
const removed = (
  id: string,
  collection: OfflineRecord["collection"] = "tasks"
): OfflineRecord => ({ collection, id, state: "deleted" });

function snapshot(
  revision = 5,
  records: readonly OfflineRecord[] = [item("task-1", "a")],
  accountId = "account-A",
  rootDigest = digest("e")
): OfflineSnapshot {
  return { revision, accountId, records, rootDigest };
}

function input(
  overrides: Partial<OfflinePreflightInput> = {}
): OfflinePreflightInput {
  return {
    authenticatedAccountId: "account-A",
    base: snapshot(),
    local: snapshot(),
    remote: snapshot(),
    ...overrides,
  };
}

describe("B64 offline sync three-way safety preflight", () => {
  it("recognizes an unchanged, verified-revision snapshot without writing", () => {
    expect(preflightOfflineSync(input())).toMatchObject({
      kind: "unchanged",
      expectedRemoteRevision: 5,
      localChanged: false,
      remoteChanged: false,
    });
  });

  it("permits only an explicit revision-checked upload when remote is unchanged", () => {
    expect(
      preflightOfflineSync(input({ local: snapshot(5, [item("task-1", "b")]) }))
    ).toMatchObject({
      kind: "ready_for_revision_checked_write",
      expectedRemoteRevision: 5,
      localChanged: true,
      remoteChanged: false,
      requiresHumanOrReviewedMerge: false,
    });
  });

  it("adopts server state if the device made no local change", () => {
    expect(
      preflightOfflineSync(
        input({ remote: snapshot(6, [item("task-1", "b")]) })
      )
    ).toMatchObject({
      kind: "adopt_remote",
      expectedRemoteRevision: 6,
      localChanged: false,
      remoteChanged: true,
    });
  });

  it("requires a reviewed rebase for disjoint concurrent edits", () => {
    const result = preflightOfflineSync(
      input({
        local: snapshot(5, [item("task-1", "b")]),
        remote: snapshot(6, [item("task-1", "a"), item("task-2", "c")]),
      })
    );
    expect(result).toMatchObject({
      kind: "rebase_required",
      requiresHumanOrReviewedMerge: true,
      conflicts: [],
    });
  });

  it("flags competing edits to the same record", () => {
    expect(
      preflightOfflineSync(
        input({
          local: snapshot(5, [item("task-1", "b")]),
          remote: snapshot(6, [item("task-1", "c")]),
        })
      )
    ).toMatchObject({
      kind: "manual_review",
      conflicts: [
        {
          collection: "tasks",
          id: "task-1",
          kind: "same_record_edited",
        },
      ],
    });
  });

  it("detects a delete-versus-edit conflict instead of resurrecting data", () => {
    expect(
      preflightOfflineSync(
        input({
          local: snapshot(5, [removed("task-1")]),
          remote: snapshot(6, [item("task-1", "b")]),
        })
      )
    ).toMatchObject({
      kind: "manual_review",
      conflicts: [
        { collection: "tasks", id: "task-1", kind: "delete_versus_edit" },
      ],
    });
  });

  it("rejects silent disappearance of a record without a tombstone", () => {
    expect(preflightOfflineSync(input({ local: snapshot(5, []) }))).toEqual({
      kind: "blocked",
      reason: "missing_deletion_marker",
    });
  });

  it("refuses to forget existing tombstones on another device", () => {
    const base = snapshot(5, [removed("task-1")]);
    expect(
      preflightOfflineSync(
        input({
          base,
          local: snapshot(5, []),
          remote: snapshot(6, [removed("task-1")]),
        })
      )
    ).toEqual({ kind: "blocked", reason: "missing_deletion_marker" });
  });

  it("refuses to resurrect previously deleted records", () => {
    expect(
      preflightOfflineSync(
        input({
          base: snapshot(5, [removed("task-1")]),
          local: snapshot(5, [item("task-1", "a")]),
          remote: snapshot(6, [removed("task-1")]),
        })
      )
    ).toEqual({ kind: "blocked", reason: "tombstone_resurrection" });
  });

  it("does not combine account A and B histories", () => {
    expect(
      preflightOfflineSync(
        input({
          remote: snapshot(6, [item("task-1", "a")], "account-B"),
        })
      )
    ).toEqual({ kind: "blocked", reason: "account_mismatch" });
  });

  it("rejects stale local baselines and server rollback revisions", () => {
    expect(preflightOfflineSync(input({ local: snapshot(4) }))).toEqual({
      kind: "blocked",
      reason: "invalid_revision",
    });
    expect(preflightOfflineSync(input({ remote: snapshot(4) }))).toEqual({
      kind: "blocked",
      reason: "invalid_revision",
    });
  });

  it("rejects a changed remote snapshot falsely reusing the same revision", () => {
    expect(
      preflightOfflineSync(
        input({ remote: snapshot(5, [item("task-1", "b")]) })
      )
    ).toEqual({
      kind: "blocked",
      reason: "revision_content_mismatch",
    });
  });

  it("requires review when scalar settings change independently", () => {
    expect(
      preflightOfflineSync(
        input({
          local: snapshot(5, [item("task-1", "a")], "account-A", digest("a")),
          remote: snapshot(6, [item("task-1", "a")], "account-A", digest("b")),
        })
      )
    ).toMatchObject({
      kind: "manual_review",
      conflicts: [
        {
          collection: "workspaceScalars",
          id: "singleton",
          kind: "same_record_edited",
        },
      ],
    });
  });

  it("does not confuse a matching concurrently added record with a conflict", () => {
    expect(
      preflightOfflineSync(
        input({
          local: snapshot(5, [item("task-1", "a"), item("task-2", "b")]),
          remote: snapshot(6, [item("task-1", "a"), item("task-2", "b")]),
        })
      )
    ).toMatchObject({ kind: "rebase_required", conflicts: [] });
  });

  it("rejects duplicate records and unknown collection identities", () => {
    expect(
      preflightOfflineSync(
        input({
          local: snapshot(5, [item("task-1", "a"), item("task-1", "b")]),
        })
      )
    ).toEqual({ kind: "blocked", reason: "invalid_snapshot" });
    expect(
      preflightOfflineSync(
        input({
          local: snapshot(5, [
            {
              ...item("task-1", "a"),
              collection: "unknown" as OfflineRecord["collection"],
            },
          ]),
        })
      )
    ).toEqual({ kind: "blocked", reason: "invalid_snapshot" });
  });

  it("rejects malformed and excessive snapshot fingerprints", () => {
    expect(
      preflightOfflineSync(
        input({
          remote: snapshot(6, [item("task-1", "g")]),
        })
      )
    ).toEqual({ kind: "blocked", reason: "invalid_snapshot" });
    expect(
      preflightOfflineSync(
        input({
          local: snapshot(5, [item("task-1", "a")], "account-A", "invalid"),
        })
      )
    ).toEqual({ kind: "blocked", reason: "invalid_snapshot" });
  });

  it("bounds adversarial conflict output without losing review status", () => {
    const original = Array.from({ length: 40 }, (_, i) =>
      item("task-" + i, "a")
    );
    const result = preflightOfflineSync(
      input({
        base: snapshot(5, original),
        local: snapshot(
          5,
          original.map(entry => item(entry.id, "b"))
        ),
        remote: snapshot(
          6,
          original.map(entry => item(entry.id, "c"))
        ),
      })
    );
    expect(result.kind).toBe("manual_review");
    if (result.kind === "manual_review") {
      expect(result.conflicts).toHaveLength(32);
      expect(result.truncatedConflicts).toBe(true);
    }
  });
});
