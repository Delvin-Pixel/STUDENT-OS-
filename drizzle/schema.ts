import type {
  AcademicGovernanceEventType,
} from "../shared/academicPolicyGovernanceLedger";

import {
  boolean,
  customType,
  index,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Browser push endpoints are URL credentials emitted by browser push
 * services. They are ASCII by definition, so keeping this column ASCII
 * preserves the full 2,048-character endpoint while keeping its unique index
 * within MySQL's byte limit.
 */
const pushEndpoint = customType<{ data: string }>({
  dataType: () => "varchar(2048) CHARACTER SET ascii COLLATE ascii_bin",
});
const storageKey = customType<{ data: string }>({
  dataType: () => "varchar(1024) CHARACTER SET ascii COLLATE ascii_bin",
});

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Provider-neutral authentication subject stored in the legacy openId column for database compatibility. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Server-side per-user workspace. JSON blob of the Student OS local-state shape. */
  workspace: mediumtext("workspace"),
  /** Canonical workspace data shape stored in the JSON blob. */
  workspaceSchemaVersion: int("workspaceSchemaVersion").notNull().default(1),
  /** Monotonic revision used to reject stale multi-device workspace writes. */
  workspaceRevision: int("workspaceRevision").notNull().default(0),
  /** Timestamp of the last accepted workspace write, distinct from sign-in activity. */
  workspaceUpdatedAt: timestamp("workspaceUpdatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Append-only, account-owned curriculum *preferences* from onboarding.
 *
 * These rows are not official enrolment, source approval, verified policy,
 * or mastery evidence. Only the authenticated owner can create/read them.
 * The client cannot set authority or review status.
 */
export const academicContextCandidates = mysqlTable(
  "academic_context_candidates",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull(),
    candidateId: varchar("candidateId", { length: 36 }).notNull(),
    requestKey: varchar("requestKey", { length: 128 }).notNull(),
    countryCode: varchar("countryCode", { length: 2 }).notNull().default("GH"),
    educationLevel: mysqlEnum("educationLevel", [
      "JHS",
      "SHS",
      "TERTIARY",
    ]).notNull(),
    enrollmentMode: mysqlEnum("enrollmentMode", [
      "institutional",
      "remedial",
      "private_candidate",
      "transfer",
    ]).notNull(),
    institutionId: varchar("institutionId", { length: 160 }),
    curriculumId: varchar("curriculumId", { length: 160 }).notNull(),
    curriculumVersion: varchar("curriculumVersion", { length: 64 }).notNull(),
    academicYear: varchar("academicYear", { length: 80 }),
    yearOrLevel: varchar("yearOrLevel", { length: 80 }),
    termOrSemester: varchar("termOrSemester", { length: 80 }),
    programId: varchar("programId", { length: 160 }),
    qualificationId: varchar("qualificationId", { length: 160 }),
    dataOrigin: mysqlEnum("dataOrigin", ["learner_declared"])
      .notNull()
      .default("learner_declared"),
    authorityStatus: mysqlEnum("authorityStatus", ["unverified"])
      .notNull()
      .default("unverified"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("academic_context_candidates_owner_key_unique").on(
      table.openId,
      table.requestKey
    ),
    uniqueIndex("academic_context_candidates_candidate_unique").on(
      table.candidateId
    ),
    index("academic_context_candidates_owner_recent_idx").on(
      table.openId,
      table.id
    ),
  ]
);

export type AcademicContextCandidate =
  typeof academicContextCandidates.$inferSelect;

/**
 * Append-only governance event envelopes. Application writers must only INSERT;
 * production DB roles must separately deny UPDATE/DELETE and protect checkpoints.
 * Rows alone do not establish signer authority or official curriculum approval.
 */
export const academicPolicyGovernanceEvents = mysqlTable(
  "academic_policy_governance_events",
  {
    id: int("id").autoincrement().primaryKey(),
    eventId: varchar("eventId", { length: 36 }).notNull(),
    authorityId: varchar("authorityId", { length: 160 }).notNull(),
    sequence: int("sequence").notNull(),
    eventType: mysqlEnum("eventType", [
      "source_manifest_reviewed",
      "policy_attestation_recorded",
      "policy_published",
      "policy_suspended",
      "policy_revoked",
      "signer_registered",
      "signer_revoked",
      "signing_key_rotated",
    ]).$type<AcademicGovernanceEventType>().notNull(),
    subjectId: varchar("subjectId", { length: 160 }).notNull(),
    subjectVersion: varchar("subjectVersion", { length: 64 }),
    scope: json("scope").$type<Record<string, unknown>>().notNull(),
    sourceManifestSha256: varchar("sourceManifestSha256", { length: 64 }),
    actorPrincipalId: varchar("actorPrincipalId", { length: 160 }).notNull(),
    reviewerPrincipalId: varchar("reviewerPrincipalId", { length: 160 }).notNull(),
    actorKeyId: varchar("actorKeyId", { length: 160 }).notNull(),
    reviewerKeyId: varchar("reviewerKeyId", { length: 160 }).notNull(),
    actorSignature: varchar("actorSignature", { length: 128 }).notNull(),
    reviewerSignature: varchar("reviewerSignature", { length: 128 }).notNull(),
    requestKey: varchar("requestKey", { length: 128 }).notNull(),
    occurredAt: timestamp("occurredAt").notNull(),
    previousEventHash: varchar("previousEventHash", { length: 64 }).notNull(),
    eventHash: varchar("eventHash", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("academic_policy_governance_event_id_unique").on(table.eventId),
    uniqueIndex("academic_policy_governance_authority_sequence_unique").on(
      table.authorityId,
      table.sequence
    ),
    uniqueIndex("academic_policy_governance_authority_request_unique").on(
      table.authorityId,
      table.requestKey
    ),
    uniqueIndex("academic_policy_governance_authority_hash_unique").on(
      table.authorityId,
      table.eventHash
    ),
    index("academic_policy_governance_authority_created_idx").on(
      table.authorityId,
      table.createdAt
    ),
  ]
);

export type AcademicPolicyGovernanceEvent =
  typeof academicPolicyGovernanceEvents.$inferSelect;

/**
 * Server-authoritative subscription state. The client never writes this table
 * directly; future payment webhooks/admin reconciliation will own mutations.
 * Accounts without a row resolve to the Free plan.
 */
export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull(),
    plan: mysqlEnum("plan", ["free", "premium"]).notNull().default("free"),
    status: mysqlEnum("status", [
      "active",
      "trial",
      "past_due",
      "canceled",
      "expired",
    ])
      .notNull()
      .default("active"),
    provider: mysqlEnum("provider", ["none", "paystack", "hubtel", "manual"])
      .notNull()
      .default("none"),
    providerCustomerId: varchar("providerCustomerId", { length: 191 }),
    providerSubscriptionId: varchar("providerSubscriptionId", { length: 191 }),
    currentPeriodStart: timestamp("currentPeriodStart"),
    currentPeriodEnd: timestamp("currentPeriodEnd"),
    cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull().default(false),
    lastVerifiedAt: timestamp("lastVerifiedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("subscriptions_owner_unique").on(table.openId),
    uniqueIndex("subscriptions_provider_subscription_unique").on(
      table.provider,
      table.providerSubscriptionId
    ),
    index("subscriptions_status_period_idx").on(
      table.status,
      table.currentPeriodEnd
    ),
  ]
);

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/** A device-local browser push subscription. Endpoint URLs are opaque credentials. */
export const pushDevices = mysqlTable(
  "push_devices",
  {
    id: int("id").autoincrement().primaryKey(),
    endpoint: pushEndpoint("endpoint").notNull().unique(),
    /** External authentication account that owns this opaque browser endpoint. */
    openId: varchar("openId", { length: 64 }),
    p256dh: varchar("p256dh", { length: 256 }).notNull(),
    auth: varchar("auth", { length: 128 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    /** Atomic cooldown anchor for learner-initiated connection-test notifications. */
    lastTestedAt: timestamp("lastTestedAt"),
  },
  table => [index("push_devices_owner_idx").on(table.openId)]
);

/** Server-side reminder deliveries generated from a device's local Student OS plan. */
export const pushReminders = mysqlTable(
  "push_reminders",
  {
    id: int("id").autoincrement().primaryKey(),
    deviceId: int("deviceId").notNull(),
    dedupeKey: varchar("dedupeKey", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    targetUrl: varchar("targetUrl", { length: 512 }).notNull(),
    /** A bounded optional Android/browser vibration sequence; no private study data. */
    vibration: json("vibration").$type<number[] | null>(),
    fireAt: timestamp("fireAt").notNull(),
    /** Number of transport attempts claimed by the managed dispatch worker. */
    deliveryAttempts: int("deliveryAttempts").notNull().default(0),
    /** Earliest safe retry time; also serves as a short in-flight claim lease. */
    nextAttemptAt: timestamp("nextAttemptAt"),
    sentAt: timestamp("sentAt"),
    /** Terminal failure after the bounded retry budget; retained for technical history only. */
    retiredAt: timestamp("retiredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("push_reminders_due_idx").on(table.fireAt, table.sentAt),
    index("push_reminders_retry_idx").on(
      table.nextAttemptAt,
      table.sentAt,
      table.retiredAt
    ),
    index("push_reminders_device_idx").on(table.deviceId),
    uniqueIndex("push_reminders_device_dedupe_unique").on(
      table.deviceId,
      table.dedupeKey
    ),
  ]
);

/** Persists the managed recurring dispatch job so scheduled callbacks can be authenticated. */
export const pushSchedules = mysqlTable("push_schedules", {
  id: int("id").autoincrement().primaryKey(),
  taskUid: varchar("taskUid", { length: 128 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Privacy-safe delivery outcomes; reminder titles and bodies are deliberately never copied here. */
export const pushDeliveryHistory = mysqlTable(
  "push_delivery_history",
  {
    id: int("id").autoincrement().primaryKey(),
    deviceId: int("deviceId").notNull(),
    reminderId: int("reminderId"),
    kind: mysqlEnum("kind", ["reminder", "test"]).notNull(),
    status: mysqlEnum("status", ["accepted", "failed", "expired"]).notNull(),
    responseCode: int("responseCode"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("push_delivery_history_device_created_idx").on(
      table.deviceId,
      table.createdAt
    ),
  ]
);

export type PushDevice = typeof pushDevices.$inferSelect;
export type PushReminder = typeof pushReminders.$inferSelect;
export type PushDeliveryHistory = typeof pushDeliveryHistory.$inferSelect;

/** Durable, per-account AI request counters shared by all application instances. */
export const aiRateLimits = mysqlTable(
  "ai_rate_limits",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull(),
    surface: mysqlEnum("surface", [
      "lesson",
      "assistant",
      "learning_draft",
    ]).notNull(),
    minuteBucket: int("minuteBucket").notNull(),
    minuteCount: int("minuteCount").notNull().default(0),
    dayKey: varchar("dayKey", { length: 16 }).notNull(),
    dayCount: int("dayCount").notNull().default(0),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("ai_rate_limits_owner_surface_unique").on(
      table.openId,
      table.surface
    ),
  ]
);

export type AiRateLimit = typeof aiRateLimits.$inferSelect;

/**
 * Server-authoritative assessment metadata. Local `StudyQuiz` remains the
 * offline practice model; this table records only a learner-owned immutable
 * snapshot initiated through a protected server route.
 */
export const assessmentSessions = mysqlTable(
  "assessment_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull(),
    sourceQuizId: varchar("sourceQuizId", { length: 128 }).notNull(),
    topicId: varchar("topicId", { length: 128 }),
    status: mysqlEnum("status", ["in_progress", "submitted", "expired"])
      .notNull()
      .default("in_progress"),
    questionSetHash: varchar("questionSetHash", { length: 64 }).notNull(),
    questionCount: int("questionCount").notNull(),
    clientStartKey: varchar("clientStartKey", { length: 128 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    submittedAt: timestamp("submittedAt"),
    finalScore: int("finalScore"),
    correctCount: int("correctCount"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("assessment_sessions_owner_start_unique").on(
      table.openId,
      table.clientStartKey
    ),
    index("assessment_sessions_owner_status_idx").on(
      table.openId,
      table.status
    ),
  ]
);

/** Immutable server-side question snapshot. Correct indices are never sent before result finalization. */
export const assessmentQuestions = mysqlTable(
  "assessment_questions",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull(),
    ordinal: int("ordinal").notNull(),
    prompt: text("prompt").notNull(),
    options: json("options").$type<string[]>().notNull(),
    correctOptionIndex: int("correctOptionIndex").notNull(),
    explanation: text("explanation").notNull(),
  },
  table => [
    uniqueIndex("assessment_questions_session_ordinal_unique").on(
      table.sessionId,
      table.ordinal
    ),
  ]
);

/** Current learner answer per immutable assessment question; writable only while in progress. */
export const assessmentResponses = mysqlTable(
  "assessment_responses",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull(),
    questionOrdinal: int("questionOrdinal").notNull(),
    selectedOptionIndex: int("selectedOptionIndex").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("assessment_responses_session_question_unique").on(
      table.sessionId,
      table.questionOrdinal
    ),
  ]
);

/** Idempotent finalization record; one owner key and one final result per session. */
export const assessmentSubmissions = mysqlTable(
  "assessment_submissions",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull(),
    sessionId: int("sessionId").notNull(),
    clientSubmitKey: varchar("clientSubmitKey", { length: 128 }).notNull(),
    score: int("score").notNull(),
    correctCount: int("correctCount").notNull(),
    questionCount: int("questionCount").notNull(),
    finalizedAt: timestamp("finalizedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("assessment_submissions_owner_key_unique").on(
      table.openId,
      table.clientSubmitKey
    ),
    uniqueIndex("assessment_submissions_session_unique").on(table.sessionId),
  ]
);

export type AssessmentSession = typeof assessmentSessions.$inferSelect;
export type AssessmentQuestion = typeof assessmentQuestions.$inferSelect;
export type AssessmentResponse = typeof assessmentResponses.$inferSelect;
export type AssessmentSubmission = typeof assessmentSubmissions.$inferSelect;

/** Durable per-account allocation used to cap private material uploads before storage writes. */
export const materialStorageUsage = mysqlTable("material_storage_usage", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  fileCount: int("fileCount").notNull().default(0),
  storedBytes: int("storedBytes").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Upload metadata prevents duplicate content writes and retains pending-write provenance for quota controls. */
export const materialUploads = mysqlTable(
  "material_uploads",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull(),
    contentSha256: varchar("contentSha256", { length: 64 }).notNull(),
    storageKey: storageKey("storageKey"),
    sizeBytes: int("sizeBytes").notNull(),
    mimeType: varchar("mimeType", { length: 128 }).notNull(),
    status: mysqlEnum("status", ["pending", "stored"])
      .notNull()
      .default("pending"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("material_uploads_owner_hash_unique").on(
      table.openId,
      table.contentSha256
    ),
    uniqueIndex("material_uploads_storage_key_unique").on(table.storageKey),
    index("material_uploads_owner_status_idx").on(table.openId, table.status),
  ]
);
