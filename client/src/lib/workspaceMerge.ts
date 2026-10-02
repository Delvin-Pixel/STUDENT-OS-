import type {
  StudyState,
  SyncTombstone,
  SyncTombstoneCollection,
} from "./types";

type Identified = { id: string };

function tombstoneKey(collection: SyncTombstoneCollection, id: string) {
  return `${collection}:${id}`;
}

function mergeTombstones(cloud: SyncTombstone[], local: SyncTombstone[]) {
  const merged = new Map<string, SyncTombstone>();
  for (const entry of [...cloud, ...local]) {
    const key = tombstoneKey(entry.collection, entry.id);
    const existing = merged.get(key);
    if (!existing || entry.deletedAt > existing.deletedAt)
      merged.set(key, entry);
  }
  return Array.from(merged.values()).sort((a, b) =>
    tombstoneKey(a.collection, a.id).localeCompare(
      tombstoneKey(b.collection, b.id)
    )
  );
}

function mergeById<T extends Identified>(
  cloud: T[],
  local: T[],
  collection: SyncTombstoneCollection,
  tombstones: SyncTombstone[]
) {
  const merged = new Map<string, T>();
  for (const item of cloud) merged.set(item.id, item);
  // The device that detected the conflict keeps its own edited version for the
  // same item; non-overlapping cloud and local additions are both preserved.
  for (const item of local) merged.set(item.id, item);
  const deleted = new Set(
    tombstones
      .filter(entry => entry.collection === collection)
      .map(entry => entry.id)
  );
  return Array.from(merged.values()).filter(item => !deleted.has(item.id));
}

function mergeDecks(
  cloud: StudyState["decks"],
  local: StudyState["decks"],
  tombstones: SyncTombstone[]
) {
  const cloudById = new Map(cloud.map(deck => [deck.id, deck]));
  return mergeById(cloud, local, "decks", tombstones).map(deck => {
    const serverDeck = cloudById.get(deck.id);
    return serverDeck
      ? {
          ...serverDeck,
          ...deck,
          cards: mergeById(serverDeck.cards, deck.cards, "cards", tombstones),
        }
      : { ...deck, cards: mergeById([], deck.cards, "cards", tombstones) };
  });
}

function mergeStudyPlans(
  cloud: StudyState["studyPlans"],
  local: StudyState["studyPlans"],
  tombstones: SyncTombstone[]
) {
  const cloudById = new Map(cloud.map(plan => [plan.id, plan]));
  const localById = new Map(local.map(plan => [plan.id, plan]));
  return mergeById(cloud, local, "studyPlans", tombstones).map(plan => {
    const serverPlan = cloudById.get(plan.id);
    const localPlan = localById.get(plan.id);
    return {
      ...(serverPlan ?? {}),
      ...plan,
      items: mergeById(
        serverPlan?.items ?? [],
        localPlan?.items ?? plan.items,
        "studyPlanItems",
        tombstones
      ),
    };
  });
}

function mergeExams(
  cloud: StudyState["exams"],
  local: StudyState["exams"],
  tombstones: SyncTombstone[]
) {
  const cloudById = new Map(cloud.map(exam => [exam.id, exam]));
  const localById = new Map(local.map(exam => [exam.id, exam]));
  return mergeById(cloud, local, "exams", tombstones).map(exam => {
    const serverExam = cloudById.get(exam.id);
    const localExam = localById.get(exam.id);
    return {
      ...(serverExam ?? {}),
      ...exam,
      topics: mergeById(
        serverExam?.topics ?? [],
        localExam?.topics ?? exam.topics,
        "examTopics",
        tombstones
      ),
    };
  });
}

function mergeHabitLog(
  cloud: StudyState["habitLog"],
  local: StudyState["habitLog"],
  tombstones: SyncTombstone[]
) {
  const deletedHabits = new Set(
    tombstones
      .filter(entry => entry.collection === "habits")
      .map(entry => entry.id)
  );
  const dates = Array.from(
    new Set([...Object.keys(cloud), ...Object.keys(local)])
  ).sort();
  return Object.fromEntries(
    dates.flatMap(date => {
      const habitIds = Array.from(
        new Set([...(cloud[date] ?? []), ...(local[date] ?? [])])
      )
        .filter(id => !deletedHabits.has(id))
        .sort();
      return habitIds.length ? [[date, habitIds]] : [];
    })
  );
}

/**
 * Preserve independent records during a revision conflict. Scalar preferences
 * remain local so the learner who is actively editing never loses a choice;
 * item collections are merged by stable record ID.
 */
export function mergeWorkspaceStates(
  cloud: StudyState,
  local: StudyState
): StudyState {
  const syncTombstones = mergeTombstones(
    cloud.syncTombstones ?? [],
    local.syncTombstones ?? []
  );
  return {
    ...cloud,
    ...local,
    tasks: mergeById(cloud.tasks, local.tasks, "tasks", syncTombstones),
    sessions: mergeById(
      cloud.sessions,
      local.sessions,
      "sessions",
      syncTombstones
    ),
    topics: mergeById(cloud.topics, local.topics, "topics", syncTombstones),
    learningEvidence: mergeById(
      cloud.learningEvidence,
      local.learningEvidence,
      "learningEvidence",
      syncTombstones
    ),
    studyPlans: mergeStudyPlans(
      cloud.studyPlans,
      local.studyPlans,
      syncTombstones
    ),
    quizzes: mergeById(cloud.quizzes, local.quizzes, "quizzes", syncTombstones),
    quizAttempts: mergeById(
      cloud.quizAttempts,
      local.quizAttempts,
      "quizAttempts",
      syncTombstones
    ),
    studyMaterials: mergeById(
      cloud.studyMaterials,
      local.studyMaterials,
      "studyMaterials",
      syncTombstones
    ),
    decks: mergeDecks(cloud.decks, local.decks, syncTombstones),
    exams: mergeExams(cloud.exams, local.exams, syncTombstones),
    events: mergeById(cloud.events, local.events, "events", syncTombstones),
    transactions: mergeById(
      cloud.transactions,
      local.transactions,
      "transactions",
      syncTombstones
    ),
    goals: mergeById(cloud.goals, local.goals, "goals", syncTombstones),
    focusSessions: mergeById(
      cloud.focusSessions,
      local.focusSessions,
      "focusSessions",
      syncTombstones
    ),
    notes: mergeById(cloud.notes, local.notes, "notes", syncTombstones),
    achievements: mergeById(
      cloud.achievements,
      local.achievements,
      "achievements",
      syncTombstones
    ),
    notifications: mergeById(
      cloud.notifications,
      local.notifications,
      "notifications",
      syncTombstones
    ),
    customReminders: mergeById(
      cloud.customReminders,
      local.customReminders,
      "customReminders",
      syncTombstones
    ).slice(0, 3),
    aiAnswerRatings: mergeById(
      cloud.aiAnswerRatings.map(rating => ({
        ...rating,
        id: `${rating.surface}:${rating.answerId}`,
      })),
      local.aiAnswerRatings.map(rating => ({
        ...rating,
        id: `${rating.surface}:${rating.answerId}`,
      })),
      "aiAnswerRatings",
      syncTombstones
    )
      .slice(0, 100)
      .map(({ id: _id, ...rating }) => rating),
    habits: mergeById(cloud.habits, local.habits, "habits", syncTombstones),
    friends: mergeById(cloud.friends, local.friends, "friends", syncTombstones),
    savedLessons: mergeById(
      cloud.savedLessons,
      local.savedLessons,
      "savedLessons",
      syncTombstones
    ),
    dailyLessonCompletions: Array.from(
      new Set([
        ...cloud.dailyLessonCompletions,
        ...local.dailyLessonCompletions,
      ])
    ),
    habitLog: mergeHabitLog(cloud.habitLog, local.habitLog, syncTombstones),
    syncTombstones,
  };
}
