#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];
const read = (file) => readFile(path.join(root, file), 'utf8');

const pkg = JSON.parse(await read('package.json'));
for (const [sectionName, deps] of Object.entries({ dependencies: pkg.dependencies, devDependencies: pkg.devDependencies })) {
  for (const [name, version] of Object.entries(deps ?? {})) {
    if (/^[~^]/.test(version)) failures.push(`${sectionName}.${name} is not pinned to an exact version.`);
  }
}
const versionSource = await read('lib/version.ts');
const readme = await read('README.md');
const envExample = await read('.env.local.example');

const version = versionSource.match(/NEXA_VERSION = '([^']+)'/)?.[1];
if (!version || version !== pkg.version) failures.push('package.json and lib/version.ts versions differ.');
if (!readme.includes(`NEXA ${version}`)) failures.push('README does not contain the current NEXA version.');
for (const variable of ['DATABASE_URL', 'AI_GATEWAY_API_KEY', 'RATE_LIMIT_SECRET', 'NEXA_DB_POOL_MAX', 'NEXA_DB_STATEMENT_TIMEOUT_MS', 'NEXA_TRANSCRIPTION_MODEL', 'NEXA_TRANSCRIPTION_TIMEOUT_MS', 'NEXA_TRANSCRIPTION_MAX_RETRIES', 'NEXA_STUDENT_OS_BRIDGE_SECRET', 'NEXA_STUDENT_OS_BRIDGE_TIMEOUT_MS']) {
  if (!envExample.includes(variable)) failures.push(`.env.local.example is missing ${variable}.`);
}

const dbSource = await read('lib/db.ts');
if (!dbSource.includes('statement_timeout: statementTimeout')) failures.push('Database pool does not enforce the configured statement timeout.');
const healthLive = await read('app/api/health/live/route.ts');
const healthReady = await read('app/api/health/ready/route.ts');
if (!healthLive.includes("status: 'ok'")) failures.push('Liveness endpoint is missing its unconditional ok response.');
if (!healthReady.includes('getReadiness')) failures.push('Readiness endpoint is not wired to the readiness service.');
const httpSource = await read('lib/http.ts');
if (!httpSource.includes("application/json")) failures.push('HTTP parser does not enforce a JSON content-type contract.');
const rateSource = await read('lib/rate-limit.ts');
if (!rateSource.includes('configured.length >= 32')) failures.push('Production rate-limit secret length validation is missing.');
if (!rateSource.includes('enforceUserMutationRateLimit')) failures.push('Shared mutation rate limiting is missing.');
const idempotencySource = await read('lib/idempotency.ts');
const idempotencyCore = await read('lib/idempotency-core.ts');
if (!idempotencySource.includes('withIdempotency')) failures.push('Idempotency transaction helper is missing.');
if (!idempotencyCore.includes('hashRequestBody') || !idempotencyCore.includes('validateIdempotencyKey')) failures.push('Idempotency request contract helpers are missing.');
const workflowEvents = await read('lib/workflow-events.ts');
if (!workflowEvents.includes('recordWorkflowEvent') || !workflowEvents.includes('listWorkflowEvents')) failures.push('Workflow event helper is missing.');
const recoveryScript = await read('scripts/recover-stale-workflows.mjs');
if (!recoveryScript.includes("process.argv.includes('--execute')")) failures.push('Stale workflow recovery is not explicitly operator-gated.');
const pruneScript = await read('scripts/prune-ops.mjs');
if (!pruneScript.includes('workflow_events')) failures.push('Workflow event retention is not included in explicit maintenance pruning.');
if (!pruneScript.includes('ai_runs') || !pruneScript.includes('aiRunsDeleted')) failures.push('AI run retention/reporting is not included in explicit maintenance pruning.');
if (!recoveryScript.includes('from ai_runs') || !recoveryScript.includes('StaleRunRecovery')) failures.push('Stale AI run recovery is missing from operator maintenance.');
const workflowRoute = await read('app/api/workflows/[id]/route.ts');
if (!workflowRoute.includes('listWorkflowEvents')) failures.push('Workflow detail route does not expose workflow events.');
const accountSource = await read('lib/account.ts');
if (!accountSource.includes("set transaction isolation level repeatable read")) failures.push('Account export does not use a repeatable-read transaction snapshot.');
if (!accountSource.includes('EXPORT_LIMIT_TOTAL_BYTES')) failures.push('Account export is missing the total byte-size bound.');
const accountRoute = await read('app/api/account/export/route.ts');
if (!accountRoute.includes('AccountExportSizeError')) failures.push('Account export route does not handle the byte-size limit.');


const aiRuntime = await read('lib/ai-runtime.ts');
if (!aiRuntime.includes('NEXA_MODEL') || !aiRuntime.includes('NEXA_AI_TOTAL_TIMEOUT_MS') || !aiRuntime.includes('NEXA_AI_MAX_RETRIES')) failures.push('AI runtime configuration is incomplete.');
const studentOsBridgeCore = await read('lib/student-os-bridge-core.ts');
const studentOsBridgeRoute = await read('app/api/integrations/student-os/route.ts');
if (!studentOsBridgeCore.includes('timingSafeEqual') || !studentOsBridgeCore.includes('STUDENT_OS_BRIDGE_SECRET_MIN_CHARS = 32')) failures.push('Student OS bridge secret validation is incomplete.');
if (!studentOsBridgeCore.includes('STUDENT_OS_BRIDGE_MAX_BODY_BYTES') || !studentOsBridgeCore.includes('STUDENT_OS_BRIDGE_CAPABILITIES')) failures.push('Student OS bridge bounds/capability contract is incomplete.');
if (!studentOsBridgeRoute.includes('readJsonBody<unknown>(request, STUDENT_OS_BRIDGE_MAX_BODY_BYTES)')) failures.push('Student OS bridge does not use bounded JSON admission.');
if (!studentOsBridgeRoute.includes("request.headers.get('x-student-os-user-id')") || !studentOsBridgeRoute.includes('headerUserId !== envelope.request.userId')) failures.push('Student OS bridge identity fencing is incomplete.');
if (!studentOsBridgeRoute.includes('createNexaProviderAdapter') || !studentOsBridgeRoute.includes("'Cache-Control': 'no-store'")) failures.push('Student OS bridge runtime wiring is incomplete.');
const voiceRuntime = await read('lib/voice.ts');
const voiceRoute = await read('app/api/voice/transcribe/route.ts');
if (!voiceRuntime.includes('gateway.transcriptionModel') || !voiceRuntime.includes('NEXA_TRANSCRIPTION_MODEL') || !voiceRuntime.includes('validateAudioSignature')) failures.push('Voice transcription runtime is incomplete.');
if (!voiceRoute.includes('readJsonBody') || !voiceRoute.includes('enforceUserMutationRateLimit') || !voiceRoute.includes('transcribeVoiceAudio')) failures.push('Voice transcription endpoint is missing bounded admission controls.');
const aiRuns = await read('lib/ai-runs.ts');
if (!aiRuns.includes('startAiRun') || !aiRuns.includes('finishAiRun') || !aiRuns.includes('failAiRun')) failures.push('AI run telemetry helpers are incomplete.');
const executionAttempts = await read('lib/workflow-execution-lease.ts');
const attemptMigration = await read('db/026_workflow_execution_attempts.sql');
const attemptEventMigration = await read('db/027_workflow_execution_attempt_events.sql');
const attemptEventSequenceMigration = await read('db/028_execution_attempt_event_sequences.sql');
const activityTraceSource = await read('lib/conversation-activity-trace.ts');
if (!executionAttempts.includes('WorkflowExecutionAttemptStatus') || !executionAttempts.includes('attemptId')) failures.push('Durable workflow execution attempt tracking is incomplete.');
if (!attemptMigration.includes('create table if not exists workflow_execution_attempts')) failures.push('Workflow execution attempt migration is missing.');
const accountExport = await read('lib/account.ts');
if (!accountExport.includes("fetchCollection(client, 'workflow_execution_attempts'")) failures.push('Account export is missing workflow execution attempts.');
const pruneOps = await read('scripts/prune-ops.mjs');
if (!pruneOps.includes('workflow_execution_attempts')) failures.push('Operational pruning is missing workflow execution attempts.');
if (!attemptEventMigration.includes('create table if not exists workflow_execution_attempt_events')) failures.push('Execution attempt lifecycle event migration is missing.');
if (!attemptEventSequenceMigration.includes('sequence_no bigint')) failures.push('Execution attempt event sequencing migration is missing.');
if (!executionAttempts.includes('coalesce(max(sequence_no), 0) + 1')) failures.push('Execution attempt event sequence assignment is missing.');
if (!attemptEventSequenceMigration.includes('workflow_execution_attempt_events_attempt_sequence_idx')) failures.push('Execution attempt event sequence uniqueness index is missing.');
if (!executionAttempts.includes('recordWorkflowExecutionAttemptEvent')) failures.push('Execution attempt lifecycle event helper is missing.');
if (!accountExport.includes("fetchCollection(client, 'workflow_execution_attempt_events'")) failures.push('Account export is missing execution attempt lifecycle events.');
if (!pruneOps.includes('workflow_execution_attempt_events')) failures.push('Operational pruning is missing execution attempt lifecycle events.');
if (!activityTraceSource.includes('from workflow_execution_attempt_events')) failures.push('Activity trace is missing execution attempt lifecycle events.');
const executionCorrelationSource = await read('lib/execution-attempt-correlation.ts');
if (!executionCorrelationSource.includes('input.workflowId !== null && input.workflowId !== undefined')) failures.push('Workflow telemetry correlation must reject workflow writes without an execution attempt.');
if (!executionCorrelationSource.includes("row.status !== 'running'")) failures.push('Workflow telemetry correlation must fence terminal execution attempts.');
const messageAttemptMigration = await read('db/032_message_execution_attempts.sql');
if (!messageAttemptMigration.includes('add column if not exists execution_attempt_id')) failures.push('Message execution-attempt provenance migration is missing.');
if (!messageAttemptMigration.includes('messages_execution_attempt_created_idx')) failures.push('Message execution-attempt index is missing.');
const chatRouteForMessages = await read('app/api/chat/route.ts');
if (!chatRouteForMessages.includes('insert into messages (conversation_id, role, content, metadata, execution_attempt_id)')) failures.push('Assistant message persistence is not attempt-aware.');
if (!chatRouteForMessages.includes("a.status = 'running'")) failures.push('Assistant message persistence does not fence terminal attempts.');
if (!chatRouteForMessages.includes('for update')) failures.push('Assistant message persistence does not lock the execution attempt.');
if (!chatRouteForMessages.includes("where execution_attempt_id = $1::uuid and role = 'assistant'")) failures.push('Assistant message persistence does not check for an existing response per execution attempt.');
if (!chatRouteForMessages.includes('if (existingAssistant.rows[0])') && chatRouteForMessages.includes('assistantMessageId = existingAssistant.rows[0].id')) failures.push('Assistant message persistence is not exactly-once per execution attempt.');
const telemetryFenceMigration = await read('db/031_execution_telemetry_fences.sql');
if (!telemetryFenceMigration.includes('ai_runs_execution_attempt_identity_fk') || !telemetryFenceMigration.includes('tool_runs_execution_attempt_identity_fk')) failures.push('Execution telemetry identity foreign keys are missing.');
if (!telemetryFenceMigration.includes('add column if not exists workflow_id uuid references workflows') || !telemetryFenceMigration.includes('tool_runs_workflow_created_idx')) failures.push('Tool telemetry workflow correlation schema is missing.');
if (!telemetryFenceMigration.includes('on delete set null (execution_attempt_id, workflow_id)')) failures.push('Execution telemetry identity foreign keys are not deletion-safe.');
const executionAttemptHistory = await read('lib/conversation-execution-attempts.ts');
const executionAttemptHistoryRoute = await read('app/api/conversations/[id]/execution-attempts/route.ts');
const executionIntegrityCheck = await read('scripts/check-execution-integrity.mjs');
if (!executionAttemptHistory.includes('encodeExecutionAttemptCursor') || !executionAttemptHistory.includes('getConversationExecutionAttempts')) failures.push('Execution attempt history helper is incomplete.');
if (!executionAttemptHistoryRoute.includes('getConversationExecutionAttempts') || !executionAttemptHistoryRoute.includes('Invalid cursor')) failures.push('Execution attempt history route is incomplete.');
const activityPanel = await read('components/activity-panel.tsx');
if (!activityPanel.includes('refreshLatest') || !activityPanel.includes('hasLoadedOlderRef')) failures.push('Activity refresh does not preserve loaded history.');
const workflowSource = await read('lib/workflows.ts');
const toolEngineSource = await read('lib/tool-engine.ts');
const tsconfig = JSON.parse(await read('tsconfig.json'));
if (!workflowSource.includes('assertWorkflowExecutionLease, recordWorkflowExecutionAttemptEvent')) failures.push('Workflow execution lease assertion is not imported.');
if (!toolEngineSource.includes('workflowId?: string | null; requestId?: string | null; executionAttemptId?: string | null')) failures.push('Tool recovery context is missing workflow correlation identity.');
if (tsconfig.compilerOptions?.baseUrl !== '.' || tsconfig.compilerOptions?.paths?.['@/*']?.[0] !== './*') failures.push('TypeScript @/ path alias is not configured.');
if (!chatRouteForMessages.includes('authenticatedUserId') || !chatRouteForMessages.includes('failChatTurn(authenticatedUserId')) failures.push('Chat error finalization does not retain authenticated user identity outside the try scope.');
const workflowRouteSource = await read('app/api/workflows/[id]/route.ts');
const executionAttemptsRouteSource = await read('app/api/conversations/[id]/execution-attempts/route.ts');
const conversationActivitySource = await read('lib/conversation-activity.ts');
if (!workflowRouteSource.includes("import { query } from '@/lib/db';")) failures.push('Workflow detail route is missing its database query import.');
if (!executionAttemptsRouteSource.includes('getRequestId') || !executionAttemptsRouteSource.includes('enforceUserReadRateLimit')) failures.push('Execution-attempt history route references obsolete HTTP/rate-limit helpers.');
if (conversationActivitySource.includes('tail.created_at')) failures.push('Conversation activity cursor uses the pre-mapped database timestamp field.');
const chatTurnSource = await read('lib/chat-turn-idempotency.ts');
const chatTurnMigration = await read('db/033_chat_turn_idempotency.sql');
const chatTurnRecoveryMigration = await read('db/034_chat_turn_recovery_leases.sql');
if (!chatTurnSource.includes('claimChatTurn') || !chatTurnSource.includes('completeChatTurn') || !chatTurnSource.includes('failChatTurn')) failures.push('Chat turn idempotency helpers are incomplete.');
if (!chatTurnMigration.includes('create table if not exists chat_turns') || !chatTurnMigration.includes('unique (user_id, idempotency_key)')) failures.push('Chat turn idempotency migration is missing its durable uniqueness contract.');
if (!chatTurnMigration.includes('expires_at')) failures.push('Chat turn idempotency migration is missing expiry recovery.');
if (!chatTurnMigration.includes('response_status integer')) failures.push('Chat turn idempotency migration is missing replay response status.');
if (!chatTurnRecoveryMigration.includes('owner_attempt_id uuid') || !chatTurnRecoveryMigration.includes('lease_expires_at timestamptz')) failures.push('Chat turn recovery migration is missing lease ownership fields.');
if (!chatTurnRecoveryMigration.includes('quota_consumed_at timestamptz')) failures.push('Chat turn recovery migration is missing durable quota consumption state.');
if (!chatTurnSource.includes('startChatTurnLeaseHeartbeat') || !chatTurnSource.includes('assertChatTurnLease') || !chatTurnSource.includes('consumeChatTurnQuota') || !chatTurnSource.includes('initializeChatTurnInput')) failures.push('Crash-safe chat turn recovery helpers are incomplete.');
if (!chatRouteForMessages.includes('NEXA_CHAT_TURN_LEASE_LOST') || !chatRouteForMessages.includes('completeChatTurn(user.id, chatTurnId, chatTurnLease, assistantMessageId, client)')) failures.push('Chat route is missing attempt-fenced atomic response commit recovery.');

if (!accountExport.includes("fetchCollection(client, 'chat_turns'")) failures.push('Account export is missing chat turn idempotency records.');
if (!chatRouteForMessages.includes('getChatTurnIdempotencyKey') || !chatRouteForMessages.includes('claimChatTurn')) failures.push('Chat route is missing idempotency-key claim handling.');
const chatTurnKeyPos = chatRouteForMessages.indexOf('claimChatTurn(');
const chatInputValidationPos = chatRouteForMessages.indexOf("if (!lastUser || (!lastUser.content.trim() && attachments.length === 0 && !voice?.transcript))");
const chatBurstAdmissionPos = chatRouteForMessages.indexOf("if (!burst.allowed) return rateLimitResponse(burst, requestId);");
const chatDailyQuotaPos = chatRouteForMessages.indexOf('const dailyLimit = getDailyMessageLimit(user.plan);');
if (!(chatTurnKeyPos > chatInputValidationPos && chatTurnKeyPos > chatBurstAdmissionPos && chatTurnKeyPos < chatDailyQuotaPos)) failures.push('Chat turn idempotency claim must occur after input/rate validation and before daily quota consumption.');

const executionAttemptTelemetryMigration = await read('db/030_execution_attempt_telemetry.sql');
const aiMigration = await read('db/018_ai_runs.sql');
if (!aiMigration.includes('create table if not exists ai_runs')) failures.push('AI run migration is missing.');
if (!executionAttemptTelemetryMigration.includes('add column if not exists execution_attempt_id')) failures.push('Execution attempt telemetry migration is missing.');
const accountSource19 = await read('lib/account.ts');
if (!accountSource19.includes("fetchCollection(client, 'ai_runs'")) failures.push('Account export is missing AI run telemetry.');
if (!accountSource19.includes('execution_attempt_id')) failures.push('Account export is missing execution attempt telemetry correlation.');

const idemMigration = await read('db/013_idempotency.sql');
if (!idemMigration.includes('unique(user_id, scope, idempotency_key)')) failures.push('Idempotency uniqueness constraint is missing.');
if (!idempotencySource.includes('expires_at <= now()')) failures.push('Idempotency TTL is not enforced during claim.');

const dbFiles = (await readdir(path.join(root, 'db'))).filter((name) => /^\d{3}_[a-z0-9_-]+\.sql$/.test(name)).sort();
const dbNumbers = dbFiles.map((name) => Number(name.slice(0, 3)));
for (let i = 0; i < dbNumbers.length; i += 1) {
  if (dbNumbers[i] !== i + 1) failures.push(`Migration sequence breaks before ${String(i + 1).padStart(3, '0')}.`);
}

async function collect(dir, extensions = /\.(ts|tsx)$/) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await collect(full, extensions));
    else if (extensions.test(entry.name)) out.push(full);
  }
  return out;
}
const apiFiles = await collect(path.join(root, 'app/api'));
for (const file of apiFiles) {
  const text = await read(file.slice(root.length + 1));
  if (/^export async function (POST|PATCH|PUT)\(/m.test(text) && /request\.json\(/.test(text)) {
    failures.push(`Unbounded request.json remains in ${path.relative(root, file)}.`);
  }
}

const checkpointProducer = await read('app/api/chat/route.ts');
if (!checkpointProducer.includes('upsertCheckpoint(')) failures.push('Workflow chat path does not persist checkpoints.');
const workflowOwnership = await read('lib/workflows.ts');

const workflowState = await read('lib/workflows.ts');
const checkpointState = await read('lib/agent-checkpoints.ts');
const workflowStepsMigration = await read('db/016_cancelled_workflow_steps.sql');
if (!workflowStepsMigration.includes("'cancelled'")) failures.push('Cancelled workflow step migration is missing.');
if (!workflowState.includes("status = 'verifying'") || !workflowState.includes("status = 'completed'")) failures.push('Workflow terminal state transitions are not guarded.');
if (!workflowState.includes("status = 'running'") || !workflowState.includes("status = 'failed'")) failures.push('Workflow resume/failure state transitions are missing.');
if (!workflowState.includes("status = 'cancelled'") || !workflowState.includes("set status = 'cancelled'")) failures.push('Workflow cancellation state transition is missing.');
if (!workflowState.includes("status in ('queued','running')") || !workflowState.includes("status = 'cancelled'")) failures.push('Cancelled workflow steps are not explicitly persisted.');
if (!checkpointState.includes("status in ('running','verifying')")) failures.push('Checkpoint writes are not restricted to live workflows.');
if (!checkpointState.includes("w.status = 'failed'")) failures.push('Resume checkpoints are not restricted to failed workflows.');
if (!workflowOwnership.includes('where id = $1 and user_id = $2')) failures.push('Workflow ownership checks appear to be missing.');
for (const route of ['app/api/projects/route.ts', 'app/api/conversations/route.ts', 'app/api/workflows/route.ts']) {
  const text = await read(route);
  if (!text.includes('getIdempotencyKey') || !text.includes('withIdempotency')) failures.push(`Idempotency support is missing from ${route}.`);
}

const secretPattern = /(sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|ghp_[A-Za-z0-9]{30,})/;
for (const file of await collect(root)) {
  if (path.extname(file) === '.md' || file.endsWith('.example') || file.endsWith('.tsbuildinfo')) continue;
  const text = await read(file.slice(root.length + 1));
  if (secretPattern.test(text)) failures.push(`Possible hard-coded credential in ${path.relative(root, file)}.`);
}

for (const file of await collect(root, /\.(ts|tsx|css|md)$/)) {
  if (/^README(?:_|\.md$)/.test(path.basename(file))) continue;
  const text = await read(file.slice(root.length + 1));
  const versionLabelPattern = /NEXA (\d+\.\d+(?:\.\d+)?)/g;
  for (const match of text.matchAll(versionLabelPattern)) {
    if (match[1] !== version) failures.push(`Stale active version label NEXA ${match[1]} in ${path.relative(root, file)}.`);
  }
}

if (failures.length) {
  console.error('NEXA validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`NEXA validation passed (${version}); ${apiFiles.length} API files checked, ${dbFiles.length} migrations checked.`);

if (!executionIntegrityCheck.includes('repeatable read') || !executionIntegrityCheck.includes('read only')) failures.push('Execution integrity checker must use a repeatable-read read-only snapshot.');
