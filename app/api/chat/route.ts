import { createNexaAgent } from '@/lib/agent';
import { selectToolNames } from '@/lib/tool-engine';
import { retrieveProjectContext } from '@/lib/project-intelligence';
import { buildAttachmentManifest, buildModelMessages, normalizeAttachments, validateVoiceInput, MAX_TEXT_LENGTH } from '@/lib/multimodal';
import { requireUser } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';
import { getDailyMessageLimit } from '@/lib/entitlements';
import { buildMemoryContext } from '@/lib/memory';
import { consumeRateLimit, rateLimitKey, rateLimitResponse } from '@/lib/rate-limit';
import { beginVerification, completeWorkflow, createWorkflow, failWorkflow, resumeWorkflow, setStepStatus, shouldCreateWorkflow, startWorkflow, verifyWorkflowResult } from '@/lib/workflows';
import { getRequestId, jsonResponse, mapBodyError, readJsonBody } from '@/lib/http';
import { consumeCheckpoint, getNextCheckpoint, upsertCheckpoint } from '@/lib/agent-checkpoints';
import { recordWorkflowEvent } from '@/lib/workflow-events';
import { getWorkflow } from '@/lib/workflows';
import { startAiRun, finishAiRun, failAiRun } from '@/lib/ai-runs';
import { getNexaAiRuntimeConfig } from '@/lib/ai-runtime';
import { startWorkflowCancellationWatcher } from '@/lib/workflow-cancellation';
import { acquireWorkflowExecutionLease, assertWorkflowExecutionLease, releaseWorkflowExecutionLease, startWorkflowExecutionLeaseHeartbeat } from '@/lib/workflow-execution-lease';
import { assertChatTurnLease, claimChatTurn, completeChatTurn, consumeChatTurnQuota, failChatTurn, getChatTurnIdempotencyKey, getReplayAssistantMessage, hashChatTurnRequest, initializeChatTurnInput, mapChatTurnIdempotencyError, startChatTurnLeaseHeartbeat, updateChatTurn, type ChatTurnLeaseIdentity } from '@/lib/chat-turn-idempotency';
import { persistAssistantMessageSources } from '@/lib/message-sources';
import { MAX_EXTERNAL_MESSAGE_SOURCES, mergeExternalSourceSnapshots, persistExternalMessageSources, type ExternalSourceSnapshot } from '@/lib/external-sources';

export const runtime = 'nodejs';

const MAX_MESSAGES = 18;

 type IncomingMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  let aiRunId: string | null = null;
  let aiRunStartedAt = Date.now();
  let aiRunExecutionAttemptId: string | null = null;
  let stopCancellationWatcher: (() => void) | null = null;
  let stopExecutionLeaseHeartbeat: (() => void) | null = null;
  let executionLeaseWorkflowId: string | null = null;
  let executionLeaseUserId: string | null = null;
  let executionLeaseAttemptId: string | null = null;
  let chatTurnId: string | null = null;
  let chatTurnLease: ChatTurnLeaseIdentity | null = null;
  let stopChatTurnLeaseHeartbeat: (() => void) | null = null;
  let recoveredChatWorkflowId: string | null = null;
  let recoveredPreviousRequestId: string | null = null;
  let authenticatedUserId: string | null = null;
  const executionController = new AbortController();
  const requestAbortHandler = () => {
    if (!executionController.signal.aborted) executionController.abort('REQUEST_ABORTED');
  };
  request.signal.addEventListener('abort', requestAbortHandler, { once: true });
  try {
    const user = await requireUser();
    authenticatedUserId = user.id;
    const finalizeClaimedTurnError = async (message: string, status: number, turnStatus: 'failed' | 'aborted' = status === 409 ? 'aborted' : 'failed') => {
      if (chatTurnId && chatTurnLease) await failChatTurn(user.id, chatTurnId, chatTurnLease, turnStatus, message, status);
      stopChatTurnLeaseHeartbeat?.();
      stopChatTurnLeaseHeartbeat = null;
      return jsonResponse({ error: message }, { status, requestId });
    };
    if (!process.env.AI_GATEWAY_API_KEY) {
      return jsonResponse(
        { error: 'NEXA is not connected to an AI Gateway key yet. Add AI_GATEWAY_API_KEY to .env.local or Vercel environment variables.' },
        { status: 503, requestId },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await readJsonBody<Record<string, unknown>>(request, 24 * 1024 * 1024);
    } catch (error) {
      return jsonResponse({ error: mapBodyError(error) ?? 'Invalid request.' }, { status: 400, requestId });
    }
    const conversationId = body?.conversationId ? String(body.conversationId) : null;
    const requestedProjectId = body?.projectId ? String(body.projectId) : null;
    const requestedWorkflowId = body?.workflowId ? String(body.workflowId) : null;
    const chatTurnKey = getChatTurnIdempotencyKey(request);
    const incoming = Array.isArray(body?.messages) ? body.messages : [];
    const messages: IncomingMessage[] = incoming
      .filter((message: unknown): message is { role: string; content: unknown } => !!message && typeof message === 'object' && 'content' in message)
      .map((message: { role: string; content: unknown }) => ({
        role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: String(message.content ?? '').slice(0, MAX_TEXT_LENGTH),
      }))
      .slice(-MAX_MESSAGES);

    let attachments;
    try {
      attachments = normalizeAttachments(Array.isArray(body?.attachments) ? body.attachments : []);
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'One or more attachments are invalid.' }, { status: 400, requestId });
    }

    let voice;
    try {
      voice = validateVoiceInput(body?.voice);
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Voice input is invalid.' }, { status: 400, requestId });
    }

    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUser || (!lastUser.content.trim() && attachments.length === 0 && !voice?.transcript)) {
      return jsonResponse({ error: 'A user message, attachment, or voice transcript is required.' }, { status: 400, requestId });
    }

    let activeConversationId = conversationId;
    if (requestedWorkflowId) {
      const existingWorkflow = await getWorkflow(user.id, requestedWorkflowId);
      if (!existingWorkflow) return jsonResponse({ error: 'Workflow not found.' }, { status: 404, requestId });
      if (conversationId && existingWorkflow.conversation_id !== conversationId) {
        return jsonResponse({ error: 'Workflow does not belong to that conversation.' }, { status: 409, requestId });
      }
      if (requestedProjectId && existingWorkflow.project_id !== requestedProjectId) {
        return jsonResponse({ error: 'Workflow does not belong to that project.' }, { status: 409, requestId });
      }
      activeConversationId = existingWorkflow.conversation_id;
      if (!activeConversationId) return jsonResponse({ error: 'This workflow has no conversation to resume.' }, { status: 409, requestId });
    }
    if (activeConversationId) {
      const owned = await query<{ id: string; project_id: string | null }>(
        'select id, project_id from conversations where id = $1 and user_id = $2 limit 1',
        [activeConversationId, user.id],
      );
      if (!owned.rows[0]) return jsonResponse({ error: 'Conversation not found.' }, { status: 404, requestId });
      if (requestedProjectId && owned.rows[0].project_id !== requestedProjectId) {
        return jsonResponse({ error: 'Conversation does not belong to that project.' }, { status: 409, requestId });
      }
    } else if (requestedProjectId) {
      const project = await query(
        'select id from projects where id = $1 and user_id = $2 limit 1',
        [requestedProjectId, user.id],
      );
      if (!project.rows[0]) return jsonResponse({ error: 'Project not found.' }, { status: 404, requestId });
    }

    const burstLimit = user.plan === 'premium' ? 60 : 20;
    const burst = await consumeRateLimit({ key: rateLimitKey('chat-user', user.id), limit: burstLimit, windowSeconds: 60 });
    if (!burst.allowed) return rateLimitResponse(burst, requestId);
    if (chatTurnKey) {
      const claim = await claimChatTurn(user.id, chatTurnKey, hashChatTurnRequest(body), requestId);
      if (claim.kind === 'in_progress') {
        return jsonResponse({ error: 'This chat turn is already being processed.' }, { status: 409, requestId, headers: { 'X-NEXA-Idempotency-Status': 'in-progress' } });
      }
      if (claim.kind === 'replay') {
        if (claim.status === 'completed') {
          const replay = await getReplayAssistantMessage(user.id, claim.conversationId, claim.assistantMessageId);
          if (!replay) return jsonResponse({ error: 'The completed idempotent response is no longer available.' }, { status: 409, requestId });
          return new Response(replay.content, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-NEXA-Idempotent-Replayed': 'true',
              ...(claim.conversationId ? { 'X-NEXA-Conversation-Id': claim.conversationId } : {}),
              ...(claim.workflowId ? { 'X-NEXA-Workflow-Id': claim.workflowId, 'X-NEXA-Mode': 'workflow-agent' } : { 'X-NEXA-Mode': 'agent' }),
              ...(claim.executionAttemptId ? { 'X-NEXA-Execution-Attempt-Id': claim.executionAttemptId } : {}),
              'X-Request-Id': requestId,
            },
          });
        }
        return jsonResponse({ error: claim.errorMessage ?? 'This idempotent request was already finalized without a replayable response.' }, { status: claim.responseStatus ?? (claim.status === 'aborted' ? 409 : 500), requestId, headers: { 'X-NEXA-Idempotent-Replayed': 'true' } });
      }
      chatTurnId = claim.turnId;
      chatTurnLease = { requestId, attemptId: claim.attemptId };
      recoveredChatWorkflowId = claim.workflowId;
      recoveredPreviousRequestId = claim.previousRequestId;
      if (claim.conversationId) activeConversationId = claim.conversationId;
      stopChatTurnLeaseHeartbeat = startChatTurnLeaseHeartbeat({
        userId: user.id,
        turnId: claim.turnId,
        requestId,
        attemptId: claim.attemptId,
        controller: executionController,
      }).stop;
    }

    const dailyLimit = getDailyMessageLimit(user.plan);
    if (chatTurnId && chatTurnLease) {
      const quota = await consumeChatTurnQuota({ userId: user.id, turnId: chatTurnId, lease: chatTurnLease, dailyLimit });
      if (!quota.owned) {
        stopChatTurnLeaseHeartbeat?.();
        stopChatTurnLeaseHeartbeat = null;
        return jsonResponse({ error: 'This chat turn changed execution owner. Retrying is safe.' }, { status: 409, requestId, headers: { 'X-NEXA-Idempotency-Status': 'in-progress' } });
      }
      if (!quota.allowed) {
        await failChatTurn(user.id, chatTurnId, chatTurnLease, 'failed', `You’ve reached today’s ${dailyLimit}-message ${user.plan} plan limit.`, 429);
        stopChatTurnLeaseHeartbeat?.();
        stopChatTurnLeaseHeartbeat = null;
        return jsonResponse(
          { error: `You’ve reached today’s ${dailyLimit}-message ${user.plan} plan limit.` },
          { status: 429, requestId },
        );
      }
    } else {
      const usage = await query<{ message_count: number }>(
        `insert into usage_daily (user_id, usage_date, message_count)
         values ($1, current_date, 1)
         on conflict (user_id, usage_date)
         do update set message_count = usage_daily.message_count + 1
         where usage_daily.message_count < $2
         returning message_count`,
        [user.id, dailyLimit],
      );
      if (usage.rows.length === 0) {
        return jsonResponse(
          { error: `You’ve reached today’s ${dailyLimit}-message ${user.plan} plan limit.` },
          { status: 429, requestId },
        );
      }
    }

    const attachmentMetadata = buildAttachmentManifest(attachments, voice);
    if (chatTurnId && chatTurnLease) {
      const initialized = await initializeChatTurnInput({
        userId: user.id,
        turnId: chatTurnId,
        lease: chatTurnLease,
        conversationId: activeConversationId,
        projectId: requestedProjectId,
        title: lastUser.content.slice(0, 80) || attachments[0]?.filename || 'New conversation',
        content: lastUser.content,
        metadata: attachmentMetadata,
      });
      if (!initialized) {
        stopChatTurnLeaseHeartbeat?.();
        stopChatTurnLeaseHeartbeat = null;
        return jsonResponse({ error: 'This chat turn changed execution owner. Retrying is safe.' }, { status: 409, requestId, headers: { 'X-NEXA-Idempotency-Status': 'in-progress' } });
      }
      activeConversationId = initialized.conversationId;
    } else {
      if (!activeConversationId) {
        const created = await query<{ id: string }>(
          `insert into conversations (user_id, project_id, title) values ($1, $2, $3) returning id`,
          [user.id, requestedProjectId, (lastUser.content.slice(0, 80) || attachments[0]?.filename || 'New conversation')],
        );
        activeConversationId = created.rows[0].id;
      }
      await query(
        `insert into messages (conversation_id, role, content, metadata)
         values ($1, 'user', $2, $3::jsonb)`,
        [activeConversationId, lastUser.content, JSON.stringify(attachmentMetadata)],
      );
      await query('update conversations set updated_at = now() where id = $1', [activeConversationId]);
    }

    let workflowStepOrder = 1;
    let workflow = null as Awaited<ReturnType<typeof getWorkflow>>;
    let resumeContext: Record<string, unknown> | null = null;
    let resumeStepOrder = 1;
    let resumeCheckpointId: string | null = null;
    if (requestedWorkflowId) {
      workflow = await getWorkflow(user.id, requestedWorkflowId);
      if (!workflow) return finalizeClaimedTurnError('Workflow not found.', 404);
      if (workflow.status !== 'failed') {
        return finalizeClaimedTurnError('This workflow is not currently in a recoverable failed state.', 409);
      }
      const checkpoint = await getNextCheckpoint(user.id, workflow.id);
      if (!checkpoint) return finalizeClaimedTurnError('No resumable checkpoint is available for this workflow.', 409);
      if (checkpoint.status === 'blocked') {
        return finalizeClaimedTurnError(checkpoint.last_error || 'This workflow requires manual intervention before it can resume.', 409);
      }
      resumeCheckpointId = checkpoint.id;
      resumeContext = checkpoint.state;
      resumeStepOrder = Math.max(1, Math.min(workflow.steps.length, Number(checkpoint.state.resumeFromStep ?? checkpoint.step_order + 1)));
      const resumed = await resumeWorkflow(user.id, workflow.id, resumeStepOrder);
      if (!resumed) return finalizeClaimedTurnError('This workflow was already resumed or changed state. Reload it and try again.', 409);
      workflowStepOrder = resumeStepOrder;
    } else if (recoveredChatWorkflowId) {
      workflow = await getWorkflow(user.id, recoveredChatWorkflowId);
      if (!workflow) return finalizeClaimedTurnError('The recovered chat turn references a workflow that is no longer available.', 409);
      if (!['running', 'verifying'].includes(workflow.status)) {
        return finalizeClaimedTurnError('The recovered workflow is no longer active. Start a new request to run it again.', 409);
      }
    } else if (shouldCreateWorkflow(lastUser.content)) {
      if (chatTurnId && chatTurnLease) {
        const activeChatTurnId = chatTurnId;
        const activeChatTurnLease = chatTurnLease;
        const workflowId = await withTransaction(async (client) => {
          const owned = await assertChatTurnLease(client, { userId: user.id, turnId: activeChatTurnId, ...activeChatTurnLease });
          if (!owned) return null;
          const existing = await client.query<{ workflow_id: string | null }>(
            `select workflow_id from chat_turns where id = $1 and user_id = $2`,
            [activeChatTurnId, user.id],
          );
          if (existing.rows[0]?.workflow_id) return existing.rows[0].workflow_id;
          const createdId = await createWorkflow({
            userId: user.id,
            projectId: requestedProjectId,
            conversationId: activeConversationId,
            request: lastUser.content,
            client,
            returnId: true,
          });
          if (typeof createdId !== 'string') throw new Error('Workflow could not be initialized.');
          await startWorkflow(user.id, createdId, client);
          await client.query(
            `update chat_turns set workflow_id = $3::uuid, updated_at = now() where id = $1 and user_id = $2`,
            [activeChatTurnId, user.id, createdId],
          );
          return createdId;
        });
        if (!workflowId) {
          stopChatTurnLeaseHeartbeat?.();
          stopChatTurnLeaseHeartbeat = null;
          return jsonResponse({ error: 'This chat turn changed execution owner. Retrying is safe.' }, { status: 409, requestId, headers: { 'X-NEXA-Idempotency-Status': 'in-progress' } });
        }
        workflow = await getWorkflow(user.id, workflowId);
      } else {
        const created = await createWorkflow({
          userId: user.id,
          projectId: requestedProjectId,
          conversationId: activeConversationId,
          request: lastUser.content,
        });
        if (typeof created !== 'string') workflow = created;
        if (workflow) await startWorkflow(user.id, workflow.id);
      }
    }

    if (workflow) {
      const lease = await acquireWorkflowExecutionLease({
        userId: user.id,
        workflowId: workflow.id,
        requestId,
        supersedeRequestId: recoveredPreviousRequestId,
      });
      if (!lease.acquired || !lease.attemptId) {
        const error = lease.terminalStatus
          ? 'This execution request has already reached a terminal state. Start a new request to run the workflow again.'
          : 'This workflow is already being executed by another request.';
        return finalizeClaimedTurnError(error, 409);
      }
      executionLeaseWorkflowId = workflow.id;
      executionLeaseUserId = user.id;
      executionLeaseAttemptId = lease.attemptId;
      if (chatTurnId && chatTurnLease) {
        const updatedTurn = await updateChatTurn(user.id, chatTurnId, chatTurnLease, { workflowId: workflow.id, executionAttemptId: executionLeaseAttemptId });
        if (!updatedTurn) {
          executionController.abort('NEXA_CHAT_TURN_LEASE_LOST');
          stopChatTurnLeaseHeartbeat?.();
          stopChatTurnLeaseHeartbeat = null;
          return jsonResponse({ error: 'This chat turn changed execution owner. Retrying is safe.' }, { status: 409, requestId, headers: { 'X-NEXA-Idempotency-Status': 'in-progress' } });
        }
      }
      stopExecutionLeaseHeartbeat = startWorkflowExecutionLeaseHeartbeat({
        userId: user.id,
        workflowId: workflow.id,
        requestId,
        attemptId: lease.attemptId,
        controller: executionController,
      }).stop;
    }

    const effectiveProjectId = requestedProjectId ?? workflow?.project_id ?? null;
    const effectiveRequest = workflow?.request ?? lastUser.content;
    const modelMessages = buildModelMessages(messages, attachments, voice);
    const memoryContext = user.memory_enabled
      ? await buildMemoryContext(user.id, effectiveRequest, effectiveProjectId)
      : { projectContext: effectiveProjectId ? 'Project memory is currently disabled.' : 'No active project.', memoryContext: 'Memory is currently disabled for this account.', memories: [] };
    const projectIntelligence = effectiveProjectId
      ? await retrieveProjectContext(user.id, effectiveProjectId, effectiveRequest, { limit: 8, includeMemory: user.memory_enabled })
      : null;
    const externalSourceSnapshots: ExternalSourceSnapshot[] = [];
    const aiRuntime = getNexaAiRuntimeConfig();
    aiRunStartedAt = Date.now();
    aiRunExecutionAttemptId = executionLeaseAttemptId;
    aiRunId = await startAiRun({
      userId: user.id,
      conversationId: activeConversationId,
      workflowId: workflow?.id ?? null,
      requestId,
      executionAttemptId: executionLeaseAttemptId,
      model: aiRuntime.model,
    });
    let aiStepCount = 0;
    let aiUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let aiFinishReason: string | null = null;
    let assistantMessageId: string | null = null;

    const agent = createNexaAgent(
      { id: user.id, name: user.name, plan: user.plan, memoryEnabled: user.memory_enabled },
      {
        projectId: effectiveProjectId,
        projectContext: memoryContext.projectContext,
        memoryContext: memoryContext.memoryContext,
        conversationId: activeConversationId,
        workflowId: workflow?.id ?? null,
        workflowPlan: workflow ? JSON.stringify(workflow.plan, null, 2) : undefined,
        workflowRequest: workflow ? workflow.request : undefined,
        resumeContext: resumeContext ?? undefined,
        intelligenceContext: projectIntelligence?.promptContext,
        requestId,
        executionAttemptId: executionLeaseAttemptId,
        requestText: workflow?.request ?? lastUser.content,
        onExternalSources: (sources) => {
          mergeExternalSourceSnapshots(externalSourceSnapshots, sources);
          if (externalSourceSnapshots.length > MAX_EXTERNAL_MESSAGE_SOURCES) externalSourceSnapshots.length = MAX_EXTERNAL_MESSAGE_SOURCES;
        },
      },
    );
    const workflowToolNames = new Set<string>();
    if (workflow) {
      stopCancellationWatcher = startWorkflowCancellationWatcher({
        userId: user.id,
        workflowId: workflow.id,
        controller: executionController,
      }).stop;
    }
    let streamErrorCleanupPromise: Promise<void> | null = null;
    const handleStreamError = (error: unknown) => {
      if (streamErrorCleanupPromise) return streamErrorCleanupPromise;
      streamErrorCleanupPromise = (async () => {
        stopCancellationWatcher?.();
        stopCancellationWatcher = null;
        stopExecutionLeaseHeartbeat?.();
        stopExecutionLeaseHeartbeat = null;
        stopChatTurnLeaseHeartbeat?.();
        stopChatTurnLeaseHeartbeat = null;
        request.signal.removeEventListener('abort', requestAbortHandler);
        const workflowLeaseLost = executionController.signal.reason === 'NEXA_WORKFLOW_LEASE_LOST';
        const chatLeaseLost = executionController.signal.reason === 'NEXA_CHAT_TURN_LEASE_LOST';
        const leaseLost = workflowLeaseLost || chatLeaseLost;
        await failAiRun({ id: aiRunId, executionAttemptId: aiRunExecutionAttemptId, durationMs: Date.now() - aiRunStartedAt, stepCount: aiStepCount, errorName: workflowLeaseLost ? 'WorkflowExecutionLeaseLost' : chatLeaseLost ? 'ChatTurnLeaseLost' : error instanceof Error ? error.name : 'UnknownError' });
        if (chatTurnId && chatTurnLease) {
          const turnStatus = leaseLost || executionController.signal.reason === 'REQUEST_ABORTED' ? 'aborted' : 'failed';
          await failChatTurn(user.id, chatTurnId, chatTurnLease, turnStatus, turnStatus === 'failed' ? 'NEXA could not complete that chat turn.' : 'The chat turn was interrupted before completion.');
        }
        if (workflow && !leaseLost) {
          const liveWorkflow = await getWorkflow(user.id, workflow.id);
          if (liveWorkflow && ['queued', 'running', 'verifying'].includes(liveWorkflow.status)) {
            await failWorkflow(user.id, workflow.id, error instanceof Error ? error.message : 'NEXA stream interrupted before the workflow completed.', { userId: user.id, workflowId: workflow.id, requestId, attemptId: executionLeaseAttemptId });
          }
        }
        if (executionLeaseWorkflowId && executionLeaseAttemptId) {
          const attemptStatus = leaseLost ? 'lease_lost' : executionController.signal.reason === 'REQUEST_ABORTED' ? 'aborted' : 'failed';
          await releaseWorkflowExecutionLease({
            userId: user.id,
            workflowId: executionLeaseWorkflowId,
            requestId,
            attemptId: executionLeaseAttemptId,
            status: attemptStatus,
            terminalReason: error instanceof Error ? error.name : 'Execution stream error.',
          });
          executionLeaseWorkflowId = null;
          executionLeaseUserId = null;
          executionLeaseAttemptId = null;
        }
      })();
      return streamErrorCleanupPromise;
    };
    const streamOptions: Parameters<typeof agent.stream>[0] & {
    } = {
      abortSignal: executionController.signal,
      messages: modelMessages,
      onStepEnd: async (event) => {
        aiStepCount = Math.max(aiStepCount, Number(event.stepNumber ?? 0) + 1);
        const usage = event.usage as { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined;
        aiUsage = {
          inputTokens: Number(usage?.inputTokens ?? 0),
          outputTokens: Number(usage?.outputTokens ?? 0),
          totalTokens: Number(usage?.totalTokens ?? (Number(usage?.inputTokens ?? 0) + Number(usage?.outputTokens ?? 0))),
        };
        aiFinishReason = String(event.finishReason ?? '') || aiFinishReason;
        if (!workflow) return;
        const names = (event.toolCalls ?? []).map((call) => String(call.toolName ?? '')).filter(Boolean);
        names.forEach((name) => workflowToolNames.add(name));
        if (workflowStepOrder <= workflow.steps.length) {
          const completedStep = workflow.steps[workflowStepOrder - 1];
          const checkpointed = await withTransaction(async (client) => {
            const liveWorkflow = await client.query<{ status: string }>(
              `select status from workflows where id = $1 and user_id = $2 and status in ('running','verifying') for update`,
              [workflow.id, user.id],
            );
            if (!liveWorkflow.rows[0]) return false;
            const leaseOwned = await assertWorkflowExecutionLease(client, { userId: user.id, workflowId: workflow.id, requestId, attemptId: executionLeaseAttemptId });
            if (!leaseOwned) {
              if (!executionController.signal.aborted) executionController.abort('NEXA_WORKFLOW_LEASE_LOST');
              return false;
            }

            await setStepStatus(user.id, workflow.id, workflowStepOrder, 'completed', { toolNames: names }, names, client, { userId: user.id, workflowId: workflow.id, requestId, attemptId: executionLeaseAttemptId });
            await upsertCheckpoint({
              userId: user.id,
              workflowId: workflow.id,
              stepOrder: workflowStepOrder,
              checkpointKey: `step-${workflowStepOrder}`,
              status: 'ready',
              state: {
                resumeFromStep: workflowStepOrder + 1,
                completedStep: completedStep?.title ?? null,
                completedStepKind: completedStep?.kind ?? null,
                toolNames: names,
                conversationId: activeConversationId,
                projectId: effectiveProjectId,
              },
              client,
            });
            await recordWorkflowEvent({
              userId: user.id,
              workflowId: workflow.id,
              eventType: 'step_checkpointed',
              stepOrder: workflowStepOrder,
              details: { toolNames: names, checkpointKey: `step-${workflowStepOrder}` },
              client,
            });
            return true;
          });
          if (checkpointed && resumeCheckpointId && workflowStepOrder === resumeStepOrder) {
            await consumeCheckpoint(user.id, resumeCheckpointId);
            resumeCheckpointId = null;
          }
          if (!checkpointed) return;
        }
        if (workflowStepOrder < workflow.steps.length) {
          workflowStepOrder += 1;
          const advanced = await withTransaction(async (client) => {
            const leaseOwned = await assertWorkflowExecutionLease(client, { userId: user.id, workflowId: workflow.id, requestId, attemptId: executionLeaseAttemptId });
            if (!leaseOwned) return false;
            return setStepStatus(user.id, workflow.id, workflowStepOrder, 'running', undefined, undefined, client, { userId: user.id, workflowId: workflow.id, requestId, attemptId: executionLeaseAttemptId });
          });
          if (!advanced && !executionController.signal.aborted) executionController.abort('NEXA_WORKFLOW_LEASE_LOST');
        }
      },
      onFinish: async ({ text, usage, finishReason }) => {
        if (finishReason === 'error') {
          await handleStreamError(new Error('AI stream finished with an error.'));
          return;
        }
        stopCancellationWatcher?.();
        stopCancellationWatcher = null;
        request.signal.removeEventListener('abort', requestAbortHandler);
        const finalUsage = usage as { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined;
        const liveWorkflow = workflow ? await getWorkflow(user.id, workflow.id) : null;
        let workflowCancelled = Boolean(workflow && liveWorkflow?.status === 'cancelled');
        let leaseLost = executionController.signal.reason === 'NEXA_WORKFLOW_LEASE_LOST' || executionController.signal.reason === 'NEXA_CHAT_TURN_LEASE_LOST';
        await finishAiRun({
          id: aiRunId,
          executionAttemptId: aiRunExecutionAttemptId,
          durationMs: Date.now() - aiRunStartedAt,
          stepCount: aiStepCount,
          inputTokens: Number(finalUsage?.inputTokens ?? aiUsage.inputTokens),
          outputTokens: Number(finalUsage?.outputTokens ?? aiUsage.outputTokens),
          totalTokens: Number(finalUsage?.totalTokens ?? aiUsage.totalTokens),
          finishReason: workflowCancelled ? 'cancelled' : leaseLost ? 'lease_lost' : String(finishReason ?? aiFinishReason ?? '') || null,
        });
        if (!workflowCancelled && !leaseLost && activeConversationId && text.trim()) {
          const messageMetadata = {
            mode: workflow ? 'workflow-agent' : 'agent',
            workflowId: workflow?.id ?? null,
            selectedTools: selectToolNames(lastUser.content, {
              projectActive: Boolean(effectiveProjectId),
              memoryEnabled: user.memory_enabled,
            }),
          };
          try {
            await withTransaction(async (client) => {
              if (chatTurnId && chatTurnLease) {
                const turnOwned = await assertChatTurnLease(client, { userId: user.id, turnId: chatTurnId, ...chatTurnLease });
                if (!turnOwned) throw new Error('NEXA_CHAT_TURN_LEASE_LOST');
              }
              if (workflow && executionLeaseAttemptId) {
                const attempt = await client.query(
                  `select a.id
                   from workflow_execution_attempts a
                   join workflows w on w.id = a.workflow_id
                   where a.id = $1 and a.user_id = $2 and a.workflow_id = $3 and w.conversation_id = $4 and w.user_id = $2 and a.status = 'running'
                   for update`,
                  [executionLeaseAttemptId, user.id, workflow.id, activeConversationId],
                );
                if (!attempt.rows[0]) throw new Error('NEXA_WORKFLOW_LEASE_LOST');

                const existingAssistant = await client.query<{ id: string }>(
                  `select id
                   from messages
                   where execution_attempt_id = $1::uuid and role = 'assistant'
                   order by created_at asc, id asc
                   limit 1`,
                  [executionLeaseAttemptId],
                );
                if (existingAssistant.rows[0]) assistantMessageId = existingAssistant.rows[0].id;
              }
              if (!assistantMessageId) {
                const insertedAssistant = await client.query<{ id: string }>(
                  `insert into messages (conversation_id, role, content, metadata, execution_attempt_id)
                   values ($1, 'assistant', $2, $3::jsonb, $4::uuid)
                   returning id`,
                  [activeConversationId, text, JSON.stringify(messageMetadata), workflow ? executionLeaseAttemptId : null],
                );
                assistantMessageId = insertedAssistant.rows[0]?.id ?? null;
                await client.query('update conversations set updated_at = now() where id = $1', [activeConversationId]);
              }
              if (assistantMessageId && projectIntelligence?.sources?.length) {
                await persistAssistantMessageSources(client, {
                  messageId: assistantMessageId,
                  conversationId: activeConversationId,
                  userId: user.id,
                  projectId: effectiveProjectId,
                  sources: projectIntelligence.sources,
                });
              }
              if (assistantMessageId && externalSourceSnapshots.length) {
                await persistExternalMessageSources(client, {
                  messageId: assistantMessageId,
                  conversationId: activeConversationId,
                  userId: user.id,
                  sources: externalSourceSnapshots,
                });
              }
              if (chatTurnId && chatTurnLease && assistantMessageId) {
                const committed = await completeChatTurn(user.id, chatTurnId, chatTurnLease, assistantMessageId, client);
                if (!committed) throw new Error('NEXA_CHAT_TURN_LEASE_LOST');
              }
            });
          } catch (commitError) {
            if (commitError instanceof Error && (commitError.message === 'NEXA_CHAT_TURN_LEASE_LOST' || commitError.message === 'NEXA_WORKFLOW_LEASE_LOST')) {
              assistantMessageId = null;
              leaseLost = true;
              if (!executionController.signal.aborted) executionController.abort(commitError.message);
            } else {
              throw commitError;
            }
          }
        }
        if (chatTurnId && chatTurnLease && !assistantMessageId && !leaseLost) {
          await failChatTurn(user.id, chatTurnId, chatTurnLease, workflowCancelled ? 'aborted' : 'failed', workflowCancelled ? 'The chat turn was cancelled before a response was persisted.' : 'NEXA did not produce a response to persist.');
        }
        let workflowAttemptFailed = false;
        if (!workflowCancelled && !leaseLost && workflow) {
          try {
            const beganVerification = await beginVerification(user.id, workflow.id, executionLeaseWorkflowId && executionLeaseAttemptId ? { userId: user.id, workflowId: workflow.id, requestId, attemptId: executionLeaseAttemptId } : undefined);
            if (!beganVerification) {
              leaseLost = executionController.signal.reason === 'NEXA_WORKFLOW_LEASE_LOST' || executionController.signal.reason === 'NEXA_CHAT_TURN_LEASE_LOST';
              if (!leaseLost) {
                const afterBegin = await getWorkflow(user.id, workflow.id);
                workflowCancelled = afterBegin?.status === 'cancelled';
                if (!workflowCancelled) workflowAttemptFailed = true;
              }
            } else {
              const verification = await verifyWorkflowResult(user.id, workflow.id, text, Array.from(workflowToolNames));
              const completed = await completeWorkflow(user.id, workflow.id, verification.passed ? 'Workflow completed and passed server-side verification.' : 'Workflow completed with verification warnings.', {
                verificationPassed: verification.passed,
                verificationChecks: verification.checks,
                verificationWarnings: verification.warnings,
                verificationToolUsed: workflowToolNames.has('verify_workflow'),
                toolsUsed: Array.from(workflowToolNames),
                finalResponseLength: text.length,
              }, executionLeaseWorkflowId && executionLeaseAttemptId ? { userId: user.id, workflowId: workflow.id, requestId, attemptId: executionLeaseAttemptId } : undefined);
              if (!completed) {
                leaseLost = executionController.signal.reason === 'NEXA_WORKFLOW_LEASE_LOST' || executionController.signal.reason === 'NEXA_CHAT_TURN_LEASE_LOST';
                if (!leaseLost) {
                  const afterComplete = await getWorkflow(user.id, workflow.id);
                  workflowCancelled = afterComplete?.status === 'cancelled';
                  if (!workflowCancelled && afterComplete?.status !== 'completed') workflowAttemptFailed = true;
                }
              }
            }
          } catch (workflowError) {
            workflowAttemptFailed = true;
            const afterError = await getWorkflow(user.id, workflow.id);
            if (afterError?.status === 'cancelled') workflowCancelled = true;
            if (afterError && ['queued', 'running', 'verifying'].includes(afterError.status)) {
              await failWorkflow(user.id, workflow.id, workflowError instanceof Error ? workflowError.message : 'Workflow verification failed.', executionLeaseWorkflowId && executionLeaseAttemptId ? { userId: user.id, workflowId: workflow.id, requestId, attemptId: executionLeaseAttemptId } : undefined);
            }
          }
        }
        stopExecutionLeaseHeartbeat?.();
        stopExecutionLeaseHeartbeat = null;
        if (executionLeaseWorkflowId && executionLeaseAttemptId) {
          const attemptStatus = workflowCancelled ? 'cancelled' : leaseLost ? 'lease_lost' : workflowAttemptFailed ? 'failed' : 'completed';
          await releaseWorkflowExecutionLease({
            userId: user.id,
            workflowId: executionLeaseWorkflowId,
            requestId,
            attemptId: executionLeaseAttemptId,
            status: attemptStatus,
            terminalReason: workflowCancelled ? 'Workflow was cancelled by the user.' : leaseLost ? 'Execution lease was lost.' : workflowAttemptFailed ? 'Workflow verification/finalization failed.' : 'Execution completed.',
          });
          executionLeaseWorkflowId = null;
          executionLeaseUserId = null;
          executionLeaseAttemptId = null;
        }
        stopChatTurnLeaseHeartbeat?.();
        stopChatTurnLeaseHeartbeat = null;
      },
    };
    let result;
    try {
      result = await agent.stream(streamOptions);
      void result.consumeStream({
        onError: (error) => { void handleStreamError(error); },
      });
    } catch (error) {
      stopCancellationWatcher?.();
      stopCancellationWatcher = null;
      stopExecutionLeaseHeartbeat?.();
      stopExecutionLeaseHeartbeat = null;
      stopChatTurnLeaseHeartbeat?.();
      stopChatTurnLeaseHeartbeat = null;
      request.signal.removeEventListener('abort', requestAbortHandler);
      if (executionLeaseWorkflowId && executionLeaseAttemptId) {
        const attemptStatus = executionController.signal.reason === 'NEXA_WORKFLOW_LEASE_LOST' || executionController.signal.reason === 'NEXA_CHAT_TURN_LEASE_LOST' ? 'lease_lost' : executionController.signal.reason === 'REQUEST_ABORTED' ? 'aborted' : 'failed';
        await releaseWorkflowExecutionLease({
          userId: user.id,
          workflowId: executionLeaseWorkflowId,
          requestId,
          attemptId: executionLeaseAttemptId,
          status: attemptStatus,
          terminalReason: error instanceof Error ? error.name : 'Stream startup failed.',
        });
        executionLeaseWorkflowId = null;
        executionLeaseUserId = null;
        executionLeaseAttemptId = null;
      }
      if (chatTurnId && chatTurnLease) {
        const turnStatus = executionController.signal.reason === 'REQUEST_ABORTED' || executionController.signal.reason === 'NEXA_CHAT_TURN_LEASE_LOST' ? 'aborted' : 'failed';
        await failChatTurn(user.id, chatTurnId, chatTurnLease, turnStatus, turnStatus === 'failed' ? 'NEXA could not start that chat turn.' : 'The chat turn was interrupted before completion.');
      }
      throw error;
    }

    return result.toTextStreamResponse({
      headers: {
        'X-NEXA-Conversation-Id': activeConversationId,
        'X-NEXA-Mode': workflow ? 'workflow-agent' : 'agent',
        ...(workflow ? { 'X-NEXA-Workflow-Id': workflow.id } : {}),
        ...(executionLeaseAttemptId ? { 'X-NEXA-Execution-Attempt-Id': executionLeaseAttemptId } : {}),
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    stopCancellationWatcher?.();
    stopCancellationWatcher = null;
    stopExecutionLeaseHeartbeat?.();
    stopExecutionLeaseHeartbeat = null;
    stopChatTurnLeaseHeartbeat?.();
    stopChatTurnLeaseHeartbeat = null;
    request.signal.removeEventListener('abort', requestAbortHandler);
    if (executionLeaseWorkflowId && executionLeaseUserId && executionLeaseAttemptId) {
      const currentLeaseWorkflowId = executionLeaseWorkflowId;
      const currentLeaseUserId = executionLeaseUserId;
      const currentAttemptId = executionLeaseAttemptId;
      const attemptStatus = executionController.signal.reason === 'NEXA_WORKFLOW_LEASE_LOST' || executionController.signal.reason === 'NEXA_CHAT_TURN_LEASE_LOST' ? 'lease_lost' : executionController.signal.reason === 'REQUEST_ABORTED' ? 'aborted' : 'failed';
      executionLeaseWorkflowId = null;
      executionLeaseUserId = null;
      executionLeaseAttemptId = null;
      try {
        await releaseWorkflowExecutionLease({
          userId: currentLeaseUserId,
          workflowId: currentLeaseWorkflowId,
          requestId,
          attemptId: currentAttemptId,
          status: attemptStatus,
          terminalReason: error instanceof Error ? error.name : 'Request failed.',
        });
      } catch {}
    }
    if (chatTurnId && authenticatedUserId && chatTurnLease) {
      const turnStatus = executionController.signal.reason === 'REQUEST_ABORTED' || executionController.signal.reason === 'NEXA_CHAT_TURN_LEASE_LOST' ? 'aborted' : 'failed';
      await failChatTurn(authenticatedUserId, chatTurnId, chatTurnLease, turnStatus, turnStatus === 'failed' ? 'NEXA could not process that chat turn.' : 'The chat turn was interrupted before completion.');
    }
    const idempotencyError = mapChatTurnIdempotencyError(error);
    if (idempotencyError) {
      return jsonResponse({ error: idempotencyError }, { status: 409, requestId });
    }
    await failAiRun({ id: aiRunId, executionAttemptId: aiRunExecutionAttemptId, durationMs: Date.now() - aiRunStartedAt, stepCount: 0, errorName: error instanceof Error ? error.name : 'UnknownError' });
    console.error('NEXA chat error', { requestId, error });
    const status = error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500;
    return Response.json(
      { error: status === 401 ? 'Sign in required.' : 'NEXA could not process that request.' },
      { status, headers: { 'X-Request-Id': requestId } },
    );
  }
}
