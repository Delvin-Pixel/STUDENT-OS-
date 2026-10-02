import type {
  StudyState,
  SyncTombstone,
  SyncTombstoneCollection,
} from "./types";

export const MAX_SYNC_TOMBSTONES = 20_000;

export class SyncTombstoneCapacityError extends Error {
  constructor() {
    super(
      "Student OS cannot safely record another deletion until this workspace is synchronized or recovered."
    );
    this.name = "SyncTombstoneCapacityError";
  }
}

function keyOf(entry: Pick<SyncTombstone, "collection" | "id">) {
  return `${entry.collection}:${entry.id}`;
}

/**
 * Records a user-intended deletion in the canonical workspace. We deliberately
 * retain one marker per entity instead of silently expiring markers: with a
 * full-snapshot protocol an offline device can be arbitrarily old, so expiry
 * would reintroduce the deletion-resurrection bug. The schema bound is a
 * defensive capacity limit; a compaction protocol requires peer acknowledgement
 * or operation cursors and must not be faked client-side.
 */
export function appendSyncTombstones(
  state: StudyState,
  collection: SyncTombstoneCollection,
  ids: string[],
  deletedAt = new Date().toISOString()
): StudyState {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return state;

  const markers = new Map(
    state.syncTombstones.map(entry => [keyOf(entry), entry])
  );
  for (const id of uniqueIds) {
    const marker: SyncTombstone = { collection, id, deletedAt };
    const existing = markers.get(keyOf(marker));
    if (!existing || marker.deletedAt > existing.deletedAt)
      markers.set(keyOf(marker), marker);
  }
  const syncTombstones = Array.from(markers.values()).sort((a, b) =>
    keyOf(a).localeCompare(keyOf(b))
  );

  // Do not discard historical deletes to fit the cap: doing so would make an
  // offline replica eligible to resurrect records. Fail the mutation instead;
  // callers can surface recovery guidance and the deleted record remains intact.
  if (syncTombstones.length > MAX_SYNC_TOMBSTONES)
    throw new SyncTombstoneCapacityError();
  return { ...state, syncTombstones };
}

/** Adds markers for records dropped by a bounded retention policy. */
export function appendRemovedSyncTombstones<T>(
  state: StudyState,
  collection: SyncTombstoneCollection,
  before: T[],
  after: T[],
  getId: (item: T) => string,
  deletedAt?: string
): StudyState {
  const retained = new Set(after.map(getId));
  return appendSyncTombstones(
    state,
    collection,
    before.filter(item => !retained.has(getId(item))).map(getId),
    deletedAt
  );
}

/**
 * Nested records have globally stable IDs but live below a parent collection.
 * Record a tombstone whenever a canonical mutation removes one, so a stale
 * peer cannot reintroduce it when the parent is later merged by ID.
 */
export function appendRemovedNestedSyncTombstones(
  before: StudyState,
  after: StudyState,
  deletedAt = new Date().toISOString()
): StudyState {
  const beforePlanItems = before.studyPlans.flatMap(plan => plan.items);
  const afterPlanItemIds = new Set(
    after.studyPlans.flatMap(plan => plan.items.map(item => item.id))
  );
  const beforeExamTopics = before.exams.flatMap(exam => exam.topics);
  const afterExamTopicIds = new Set(
    after.exams.flatMap(exam => exam.topics.map(topic => topic.id))
  );

  const withPlanItemTombstones = appendSyncTombstones(
    after,
    "studyPlanItems",
    beforePlanItems
      .filter(item => !afterPlanItemIds.has(item.id))
      .map(item => item.id),
    deletedAt
  );
  return appendSyncTombstones(
    withPlanItemTombstones,
    "examTopics",
    beforeExamTopics
      .filter(topic => !afterExamTopicIds.has(topic.id))
      .map(topic => topic.id),
    deletedAt
  );
}
