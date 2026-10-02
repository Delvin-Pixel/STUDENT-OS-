import { COOKIE_NAME } from "@shared/const";
import { validateStudyState } from "@shared/workspaceSchema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { buildLearningStateSnapshot } from "./aiLearningState";
import { enforceAiRateLimit } from "./aiRateLimit";
import {
  assessmentReadInput,
  assessmentSaveResponseInput,
  assessmentStartInput,
  assessmentSubmitInput,
  readAssessment,
  saveAssessmentResponse,
  startAssessment,
  submitAssessment,
} from "./assessments";
import { getAccountEntitlements } from "./entitlements";
import {
  generateQuizDraft,
  generateScheduleDraft,
  learningDraftRequestSchema,
  scheduleDraftRequestSchema,
} from "./learningDrafts";
import {
  answerDailyLessonQuestion,
  generateDailyLesson,
  lessonRequestSchema,
  questionRequestSchema,
} from "./lessons";
import {
  resolveOwnedProfilePhotoUrl,
  uploadProfilePhoto,
} from "./profilePhoto";
import {
  activatePushDevice,
  claimPushConnectionTest,
  disablePushDevice,
  getEnabledPushDevice,
  getPushDeliveryHistory,
  pushDeliveryStatusFromResponse,
  reconcilePushDevice,
  recordPushDeliveryHistory,
  upsertPushDevice,
} from "./pushDb";
import {
  answerStudyAssistantQuestion,
  studyAssistantRequestSchema,
} from "./studyAssistant";
import {
  resolveOwnedStudyMaterialUrl,
  studyMaterialUploadSchema,
  uploadStudyMaterial,
} from "./studyMaterials";
import {
  generateMaterialPracticeQuestions,
  generateMaterialSummary,
  materialPracticeQuestionRequestSchema,
  materialSummaryRequestSchema,
} from "./studyMaterialSummaries";
import {
  buildPushConnectionTestPayload,
  canBuildWebPushPayload,
  isSafeWebPushEndpoint,
  sendWebPush,
} from "./webPush";
import {
  clearWorkspace,
  getWorkspace,
  setWorkspace,
  validateWorkspacePayload,
} from "./workspace";

const cacheScopeInput = z
  .object({ cacheScope: z.string().min(1).max(128) })
  .optional();

const pushEndpointSchema = z
  .string()
  .url()
  .max(2048)
  .refine(isSafeWebPushEndpoint, {
    message: "Use a standard public HTTPS browser-push endpoint.",
  });

const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  p256dh: z.string().min(20).max(256),
  auth: z.string().min(8).max(128),
});

const plannedReminderSchema = z.object({
  dedupeKey: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  body: z.string().min(1).max(2000),
  targetUrl: z.string().startsWith("/").max(512),
  vibration: z
    .array(z.number().int().min(0).max(1_000))
    .min(1)
    .max(8)
    .optional(),
  fireAt: z.date(),
});

async function getAiLearningStateContext(
  openId: string,
  subject: string,
  topic: string
) {
  const record = await getWorkspace(openId);
  if (!record.workspace) return undefined;
  try {
    const parsed = validateStudyState(JSON.parse(record.workspace));
    if (!parsed.success) return undefined;
    return buildLearningStateSnapshot(
      parsed.data,
      subject,
      topic,
      new Date().toISOString().slice(0, 10)
    );
  } catch {
    return undefined;
  }
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    // Identity discovery must not duplicate the private workspace blob in a
    // broadly cached response. The workspace has its own protected route.
    me: publicProcedure.query(({ ctx }) => {
      const user = ctx.user;
      if (!user) return null;
      return {
        id: user.id,
        openId: user.openId,
        name: user.name,
        email: user.email,
        loginMethod: user.loginMethod,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastSignedIn: user.lastSignedIn,
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  entitlements: router({
    /**
     * Returns the server-authoritative plan/capability snapshot for this account.
     * No plan value is read from local storage or the synchronized workspace.
     */
    me: protectedProcedure.query(({ ctx }) =>
      getAccountEntitlements(ctx.user.openId)
    ),
  }),

  dailyLessons: router({
    generate: protectedProcedure
      .input(lessonRequestSchema)
      .mutation(async ({ ctx, input }) => {
        await enforceAiRateLimit(ctx.user.openId, "lesson");
        return generateDailyLesson(
          {
            ...input,
            learningState: await getAiLearningStateContext(
              ctx.user.openId,
              input.subject,
              input.topic
            ),
          },
          ctx.signal
        );
      }),
    ask: protectedProcedure
      .input(questionRequestSchema)
      .mutation(async ({ ctx, input }) => {
        await enforceAiRateLimit(ctx.user.openId, "lesson");
        return answerDailyLessonQuestion(input, ctx.signal);
      }),
  }),

  studyAssistant: router({
    ask: protectedProcedure
      .input(studyAssistantRequestSchema)
      .mutation(async ({ ctx, input }) => {
        await enforceAiRateLimit(ctx.user.openId, "assistant");
        return answerStudyAssistantQuestion(input, ctx.signal);
      }),
  }),

  learningDrafts: router({
    quiz: protectedProcedure
      .input(learningDraftRequestSchema)
      .mutation(async ({ ctx, input }) => {
        await enforceAiRateLimit(ctx.user.openId, "learning_draft");
        return generateQuizDraft(
          {
            ...input,
            learningState: await getAiLearningStateContext(
              ctx.user.openId,
              input.subject,
              input.topic
            ),
          },
          ctx.signal
        );
      }),
  }),

  scheduleDrafts: router({
    generate: protectedProcedure
      .input(scheduleDraftRequestSchema)
      .mutation(async ({ ctx, input }) => {
        await enforceAiRateLimit(ctx.user.openId, "learning_draft");
        return generateScheduleDraft(input, ctx.signal);
      }),
  }),

  studyMaterials: router({
    upload: protectedProcedure
      .input(studyMaterialUploadSchema)
      .mutation(({ ctx, input }) =>
        uploadStudyMaterial(ctx.user.openId, input)
      ),
    accessUrl: protectedProcedure
      .input(z.object({ storageKey: z.string().min(1).max(1_024) }))
      .mutation(({ ctx, input }) =>
        resolveOwnedStudyMaterialUrl(ctx.user.openId, input.storageKey)
      ),
    summary: protectedProcedure
      .input(materialSummaryRequestSchema)
      .mutation(async ({ ctx, input }) => {
        await enforceAiRateLimit(ctx.user.openId, "learning_draft");
        return generateMaterialSummary(
          ctx.user.openId,
          input.storageKey,
          ctx.signal
        );
      }),
    practiceQuestions: protectedProcedure
      .input(materialPracticeQuestionRequestSchema)
      .mutation(async ({ ctx, input }) => {
        await enforceAiRateLimit(ctx.user.openId, "learning_draft");
        return generateMaterialPracticeQuestions(
          ctx.user.openId,
          input.storageKey,
          ctx.signal
        );
      }),
  }),

  assessments: router({
    start: protectedProcedure
      .input(assessmentStartInput)
      .mutation(({ ctx, input }) => startAssessment(ctx.user.openId, input)),
    read: protectedProcedure
      .input(assessmentReadInput)
      .query(({ ctx, input }) => readAssessment(ctx.user.openId, input)),
    saveResponse: protectedProcedure
      .input(assessmentSaveResponseInput)
      .mutation(({ ctx, input }) =>
        saveAssessmentResponse(ctx.user.openId, input)
      ),
    submit: protectedProcedure
      .input(assessmentSubmitInput)
      .mutation(({ ctx, input }) => submitAssessment(ctx.user.openId, input)),
  }),

  profilePhoto: router({
    upload: protectedProcedure
      .input(z.object({ dataUrl: z.string().min(32).max(11_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const upload = await uploadProfilePhoto(ctx.user.openId, input.dataUrl);
        return { storageKey: upload.key } as const;
      }),
    accessUrl: protectedProcedure
      .input(z.object({ storageKey: z.string().min(1).max(1_024) }))
      .query(({ ctx, input }) =>
        resolveOwnedProfilePhotoUrl(ctx.user.openId, input.storageKey)
      ),
  }),

  push: router({
    config: protectedProcedure.query(() => {
      const configured = canBuildWebPushPayload();
      return {
        // Do not offer a public key if the matching private key cannot build an authenticated send.
        vapidPublicKey: configured ? ENV.vapidPublicKey : "",
        configured,
      };
    }),
    register: protectedProcedure
      .input(pushSubscriptionSchema)
      .mutation(async ({ ctx, input }) => {
        await upsertPushDevice(input, ctx.user.openId);
        return { success: true } as const;
      }),
    /** Atomically persists this browser subscription and its first server-side reminder plan. */
    activate: protectedProcedure
      .input(
        z.object({
          subscription: pushSubscriptionSchema,
          reminders: z.array(plannedReminderSchema).max(40),
        })
      )
      .mutation(({ ctx, input }) =>
        activatePushDevice(input.subscription, input.reminders, ctx.user.openId)
      ),
    syncReminders: protectedProcedure
      .input(
        z.object({
          subscription: pushSubscriptionSchema,
          previousEndpoint: pushEndpointSchema.nullish(),
          reminders: z.array(plannedReminderSchema).max(40),
        })
      )
      .mutation(async ({ ctx, input }) =>
        reconcilePushDevice(
          input.subscription,
          input.reminders,
          ctx.user.openId,
          input.previousEndpoint
        )
      ),
    disable: protectedProcedure
      .input(z.object({ endpoint: pushEndpointSchema }))
      .mutation(async ({ ctx, input }) => {
        await disablePushDevice(input.endpoint, ctx.user.openId);
        return { success: true } as const;
      }),
    // cacheScope partitions client query entries; the server always enforces
    // ownership through ctx.user.openId rather than this display-only value.
    deliveryHistory: protectedProcedure
      .input(
        z.object({
          endpoint: pushEndpointSchema,
          cacheScope: z.string().min(1).max(128).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        return getPushDeliveryHistory(input.endpoint, ctx.user.openId);
      }),
    /** Sends an immediate, user-requested server push so a learner can verify delivery before relying on reminders. */
    testDelivery: protectedProcedure
      .input(
        z.object({
          endpoint: pushEndpointSchema,
          vibration: z
            .array(z.number().int().min(0).max(1_000))
            .min(1)
            .max(8)
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const device = await getEnabledPushDevice(
          input.endpoint,
          ctx.user.openId
        );
        if (!device)
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "This phone is not registered for Student OS reminders. Turn reminders off and on again.",
          });
        if (!(await claimPushConnectionTest(device.id))) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "A phone notification test was just sent. Please wait one minute before trying again.",
          });
        }
        try {
          const result = await sendWebPush(
            {
              endpoint: device.endpoint,
              p256dh: device.p256dh,
              auth: device.auth,
            },
            buildPushConnectionTestPayload(input.vibration)
          );
          const status = pushDeliveryStatusFromResponse(
            result.ok,
            result.status
          );
          await recordPushDeliveryHistory({
            deviceId: device.id,
            kind: "test",
            status,
            responseCode: result.status,
          });
          if (!result.ok) {
            if (status === "expired")
              await disablePushDevice(device.endpoint, ctx.user.openId);
            throw new TRPCError({
              code: "BAD_GATEWAY",
              message:
                "The phone push service did not accept the test notification. Turn reminders off and on again, then retry.",
            });
          }
          return { accepted: true } as const;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          await recordPushDeliveryHistory({
            deviceId: device.id,
            kind: "test",
            status: "failed",
          });
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message:
              "Student OS could not reach the phone push service. Please try the test again.",
          });
        }
      }),
  }),

  workspace: router({
    /** Loads the signed-in account's server workspace. Empty/null means a fresh onboarding. */
    // cacheScope partitions browser cache entries; ctx.user remains the only
    // authorization source, so a forged scope cannot change workspace owner.
    load: protectedProcedure.input(cacheScopeInput).query(async ({ ctx }) => {
      const record = await getWorkspace(ctx.user.openId);
      let parsed: unknown = null;
      if (record.workspace) {
        try {
          parsed = JSON.parse(record.workspace);
        } catch {
          console.warn(
            "[Workspace] Corrupt server copy ignored; client keeps its own data."
          );
          parsed = null;
        }
      }
      return {
        workspace: parsed as Record<string, unknown> | null,
        revision: record.revision,
        schemaVersion: record.schemaVersion,
        updatedAt: record.updatedAt,
      } as const;
    }),
    /** Saves the signed-in account's workspace. Replaces the previous copy (last-write-wins, per device merge on the client). */
    save: protectedProcedure
      .input(
        z.object({ workspace: z.unknown(), revision: z.number().int().min(0) })
      )
      .mutation(async ({ ctx, input }) => {
        const validation = validateWorkspacePayload(input.workspace);
        if (!validation.ok)
          return { success: false as const, reason: validation.reason };
        const result = await setWorkspace(
          ctx.user.openId,
          validation.text,
          input.revision
        );
        if (!result.ok && result.reason === "conflict") {
          let workspace: unknown = null;
          try {
            workspace = result.workspace ? JSON.parse(result.workspace) : null;
          } catch {
            workspace = null;
          }
          return {
            success: false as const,
            reason: "conflict" as const,
            revision: result.revision,
            workspace,
          };
        }
        if (!result.ok)
          return { success: false as const, reason: "unavailable" as const };
        return {
          success: true as const,
          reason: null,
          revision: result.revision,
          updatedAt: result.updatedAt,
        };
      }),
    /** Erases the signed-in account's server workspace (e.g. after a fresh restart). */
    clear: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await clearWorkspace(ctx.user.openId);
      if (!result.ok) {
        throw new TRPCError({
          code:
            result.reason === "conflict" ? "CONFLICT" : "SERVICE_UNAVAILABLE",
          message:
            result.reason === "conflict"
              ? "Your workspace changed while deletion was being prepared. Please try again."
              : "Student OS could not reach the cloud workspace service.",
        });
      }
      return {
        success: true as const,
        revision: result.revision,
        updatedAt: result.updatedAt,
      };
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
