import { tool, type ToolSet } from 'ai';
import { createHash } from 'node:crypto';
import { query, withTransaction } from '@/lib/db';
import { gateway } from 'ai';
import { calculatorTool } from '@/lib/tools';
import { createMemoryTools } from '@/lib/memory-tools';
import { createArtifactTools } from '@/lib/artifact-tools';
import { createWorkflowTools } from '@/lib/workflow-tools';
import { createProjectIntelligenceTools } from '@/lib/project-intelligence-tools';
import { createProjectFileTools } from '@/lib/project-file-tools';
import { wrapExternalToolResult } from '@/lib/context-trust';
import { assertExecutionAttemptCorrelation } from '@/lib/execution-attempt-correlation';
import { collectExternalSourceSnapshots, type ExternalSourceSnapshot } from '@/lib/external-sources';

export type ToolRisk = 'read' | 'write' | 'external';
export type ToolCapability = 'research' | 'compute' | 'memory' | 'artifact' | 'workflow' | 'project-search' | 'project-file';

export const TOOL_BUDGET_LIMITS = {
  total: 12,
  write: 4,
  external: 3,
} as const;

type ToolBudget = { total: number; write: number; external: number };

export type ToolDescriptor = {
  name: string;
  capability: ToolCapability;
  risk: ToolRisk;
  summary: string;
  keywords: string[];
  requiresExplicitIntent?: boolean;
  intentPatterns?: RegExp[];
  resultTrust?: 'trusted' | 'untrusted';
};

export const TOOL_REGISTRY: ToolDescriptor[] = [
  { name: 'tako_search', capability: 'research', risk: 'external', summary: 'Live web research for current, niche, changing, or externally verifiable information.', keywords: ['latest', 'current', 'today', 'news', 'research', 'source', 'search', 'online', 'verify', 'price', 'update'], resultTrust: 'untrusted' },
  { name: 'calculator', capability: 'compute', risk: 'read', summary: 'Accurate arithmetic and calculations.', keywords: ['calculate', 'calculation', 'math', 'percentage', 'percent', 'sum', 'average', 'divide', 'multiply', 'equation'] },
  { name: 'search_memory', capability: 'memory', risk: 'read', summary: 'Retrieve saved or project memory relevant to the request.', keywords: ['remember', 'memory', 'previously', 'earlier', 'preference', 'you know about me'], resultTrust: 'untrusted' },
  { name: 'save_memory', capability: 'memory', risk: 'write', summary: 'Persist something the user explicitly asks NEXA to remember.', keywords: ['remember', 'memory'], resultTrust: 'untrusted', requiresExplicitIntent: true, intentPatterns: [/\bremember (?:that|this|to)\b/i, /\b(save|keep|store|retain) (?:this|that) (?:in|to) (?:memory|nexa)\b/i, /\bmemorize this\b/i] },
  { name: 'forget_memory', capability: 'memory', risk: 'write', summary: 'Remove a saved memory when the user explicitly asks to forget it.', keywords: ['forget', 'memory'], requiresExplicitIntent: true, intentPatterns: [/\bforget (?:this|that)\b/i, /\b(remove|delete) (?:this|that) (?:from )?memory\b/i, /\bstop remembering (?:this|that)\b/i] },
  { name: 'create_artifact', capability: 'artifact', risk: 'write', summary: 'Create a durable reusable file or deliverable.', keywords: ['create', 'make', 'generate', 'save', 'export', 'artifact', 'document', 'report', 'code file', 'dataset', 'csv', 'json', 'note'], requiresExplicitIntent: true, intentPatterns: [/\b(create|make|generate)\b.{0,60}\b(file|document|report|code|note|artifact|csv|json|dataset)\b/i, /\b(write|save|export)\b.{0,50}\b(?:as|to)\b.{0,20}\b(file|document|csv|json|artifact)\b/i, /\b(?:create|generate)\b.{0,40}\bdownloadable\b/i] },
  { name: 'list_artifacts', capability: 'artifact', risk: 'read', summary: 'List reusable files already created for the user/project.', keywords: ['files', 'artifacts', 'documents', 'what did we create', 'list files'], resultTrust: 'untrusted' },
  { name: 'get_artifact', capability: 'artifact', risk: 'read', summary: 'Read an existing reusable file before discussing or modifying it.', keywords: ['open file', 'read file', 'show file', 'artifact', 'document content'], resultTrust: 'untrusted' },
  { name: 'update_artifact', capability: 'artifact', risk: 'write', summary: 'Revise an existing durable file.', keywords: ['update', 'edit', 'revise', 'change', 'fix', 'modify', 'extend', 'replace', 'artifact', 'document', 'file'], requiresExplicitIntent: true, intentPatterns: [/\b(update|edit|revise|change|fix|modify|extend|replace)\b.{0,60}\b(file|document|artifact|report|note|code)\b/i] },
  { name: 'verify_workflow', capability: 'workflow', risk: 'read', summary: 'Verify important workflow claims and deliverables before completion.', keywords: ['verify', 'check work', 'validate', 'confirm', 'workflow'], resultTrust: 'untrusted' },
  { name: 'checkpoint_status', capability: 'workflow', risk: 'read', summary: 'Inspect resumable workflow checkpoints and blocked states.', keywords: ['checkpoint', 'resume', 'continue', 'recover', 'blocked', 'progress'], resultTrust: 'untrusted' },
  { name: 'resume_checkpoint', capability: 'workflow', risk: 'write', summary: 'Resume an agent workflow from the next safe checkpoint without repeating completed work.', keywords: ['resume', 'continue', 'recover', 'checkpoint'], resultTrust: 'untrusted', requiresExplicitIntent: true, intentPatterns: [/\bresume (?:this |the )?(?:workflow|run|checkpoint)\b/i, /\bcontinue (?:this |the )?(?:workflow|run|checkpoint)\b/i, /\brecover (?:this |the )?(?:workflow|run)\b/i, /\bresume from (?:the )?checkpoint\b/i] },
  { name: 'search_project', capability: 'project-search', risk: 'read', summary: 'Retrieve relevant conversations, artifacts, memory, and workflow state from the active project.', keywords: ['project', 'earlier in this project', 'our project', 'previous chat', 'project history', 'decision'], resultTrust: 'untrusted' },
  { name: 'list_project_files', capability: 'project-file', risk: 'read', summary: 'List persistent knowledge files attached to the active project.', keywords: ['project files', 'files in this project', 'uploaded files', 'knowledge files', 'documents in project'], resultTrust: 'untrusted' },
  { name: 'read_project_file', capability: 'project-file', risk: 'read', summary: 'Read an exact persistent project knowledge file.', keywords: ['read file', 'open file', 'project file', 'uploaded file', 'knowledge file', 'file contents'], resultTrust: 'untrusted' },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasWriteIntent(request: string, descriptor: ToolDescriptor) {
  if (!descriptor.requiresExplicitIntent) return true;
  const text = normalize(request);
  if (descriptor.intentPatterns?.length) return descriptor.intentPatterns.some((pattern) => pattern.test(text));
  return descriptor.keywords.some((keyword) => text.includes(keyword));
}

export function isExplicitToolIntent(request: string, toolName: string) {
  const descriptor = TOOL_REGISTRY.find((item) => item.name === toolName);
  return descriptor ? hasWriteIntent(request, descriptor) : false;
}

function relevanceScore(request: string, descriptor: ToolDescriptor) {
  const text = normalize(request);
  let score = 0;
  for (const keyword of descriptor.keywords) {
    if (text.includes(keyword)) score += keyword.includes(' ') ? 3 : 2;
  }
  if (descriptor.capability === 'workflow' && /build|implement|fix|ship|deploy|create|make/i.test(request)) score += 1;
  return score;
}

export function selectToolNames(request: string, options: { projectActive?: boolean; memoryEnabled?: boolean } = {}) {
  const ranked = TOOL_REGISTRY
    .filter((descriptor) => (options.memoryEnabled === false ? descriptor.capability !== 'memory' : true))
    .filter((descriptor) => !['search_project', 'list_project_files', 'read_project_file'].includes(descriptor.name) || options.projectActive)
    .map((descriptor) => ({ descriptor, score: relevanceScore(request, descriptor) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const selected = ranked.slice(0, 8).map(({ descriptor }) => descriptor.name);

  if (options.projectActive && /project|earlier in this project|project history|previous chat|decision/i.test(request.toLowerCase()) && !selected.includes('search_project')) selected.push('search_project');
  if (options.projectActive && /project file|uploaded file|knowledge file|files in this project|read file|open file/i.test(request.toLowerCase())) {
    if (!selected.includes('list_project_files')) selected.push('list_project_files');
    if (/read|open|contents?|what does|summari[sz]e|explain/i.test(request) && !selected.includes('read_project_file')) selected.push('read_project_file');
  }
  if (options.memoryEnabled !== false && /remember|forget|memory|preference|previously/i.test(request)) {
    if (!selected.includes('search_memory')) selected.push('search_memory');
  }

  return selected.filter((name, index, list) => list.indexOf(name) === index);
}

export function describeToolset(toolNames: string[]) {
  return toolNames
    .map((name) => TOOL_REGISTRY.find((descriptor) => descriptor.name === name))
    .filter(Boolean)
    .map((descriptor) => `- ${descriptor!.name}: ${descriptor!.summary}`)
    .join('\n');
}

function toolFailure(message = 'Tool execution failed.', retryable = true) {
  return {
    ok: false,
    error: message,
    retryable,
    guidance: retryable ? 'You may retry once with corrected or narrower arguments. Do not repeat the exact same call.' : 'Do not retry this exact call; explain the limitation or choose another tool.',
  };
}

function safeToolError() {
  return 'Tool execution failed. Internal details were withheld.';
}

function hashInput(input: unknown) {
  return createHash('sha256').update(JSON.stringify(input ?? {})).digest('hex');
}

function toolBudgetFailure(name: string, budget: ToolBudget, descriptor: ToolDescriptor) {
  const limit = descriptor.risk === 'write' ? TOOL_BUDGET_LIMITS.write : descriptor.risk === 'external' ? TOOL_BUDGET_LIMITS.external : TOOL_BUDGET_LIMITS.total;
  const used = descriptor.risk === 'write' ? budget.write : descriptor.risk === 'external' ? budget.external : budget.total;
  return toolFailure(`Tool budget exhausted for ${name} (${used}/${limit}).`, false);
}

function withRecovery<T extends Record<string, unknown>>(
  name: string,
  original: T,
  context: { userId: string; conversationId?: string | null; projectId?: string | null; workflowId?: string | null; requestId?: string | null; executionAttemptId?: string | null; onExternalSources?: (sources: ExternalSourceSnapshot[]) => void },
  budget: ToolBudget,
) {
  const wrapped = original;
  const attempts = new Map<string, number>();
  const descriptor = TOOL_REGISTRY.find((item) => item.name === name);

  const execute = async (input: unknown) => {
    if (!descriptor) return toolFailure(`Tool ${name} is not available for this request.`, false);
    const inputHash = hashInput(input);
    const key = inputHash;
    const count = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, count);
    if (budget.total >= TOOL_BUDGET_LIMITS.total) {
      await logToolRun({ ...context, toolName: name, risk: descriptor.risk, status: 'blocked', attempt: count, inputHash, blockedReason: 'total_budget' });
      return toolBudgetFailure(name, budget, descriptor);
    }
    if (descriptor.risk === 'write' && budget.write >= TOOL_BUDGET_LIMITS.write) {
      await logToolRun({ ...context, toolName: name, risk: descriptor.risk, status: 'blocked', attempt: count, inputHash, blockedReason: 'write_budget' });
      return toolBudgetFailure(name, budget, descriptor);
    }
    if (descriptor.risk === 'external' && budget.external >= TOOL_BUDGET_LIMITS.external) {
      await logToolRun({ ...context, toolName: name, risk: descriptor.risk, status: 'blocked', attempt: count, inputHash, blockedReason: 'external_budget' });
      return toolBudgetFailure(name, budget, descriptor);
    }
    if (count > 1 && descriptor.risk !== 'read') {
      await logToolRun({ ...context, toolName: name, risk: descriptor.risk, status: 'blocked', attempt: count, inputHash, blockedReason: 'duplicate_retry' });
      return toolFailure(`Duplicate retry blocked for ${name}. State-changing or external tools require a new, corrected request.`, false);
    }

    budget.total += 1;
    if (descriptor.risk === 'write') budget.write += 1;
    if (descriptor.risk === 'external') budget.external += 1;

    const started = Date.now();
    try {
      const result = await (wrapped as any).execute(input);
      if (name === 'tako_search' && context.onExternalSources) {
        try {
          const sources = collectExternalSourceSnapshots('tako', result);
          if (sources.length) context.onExternalSources(sources);
        } catch {
          // Provenance extraction is fail-soft and must never break live research.
        }
      }
      const safeResult = descriptor.risk === 'external' || descriptor.resultTrust === 'untrusted'
        ? wrapExternalToolResult(name, result)
        : result;
      await logToolRun({ ...context, toolName: name, risk: descriptor.risk, status: 'success', attempt: count, inputHash, durationMs: Date.now() - started });
      return safeResult;
    } catch (error) {
      // Read-only tools may be retried once. Writes and external calls do not auto-retry because an ambiguous failure may already have committed a side effect.
      const retryable = descriptor.risk === 'read' && count < 2;
      await logToolRun({ ...context, toolName: name, risk: descriptor.risk, status: 'error', attempt: count, inputHash, durationMs: Date.now() - started, error: safeToolError() });
      return toolFailure(safeToolError(), retryable);
    }
  };

  return {
    ...wrapped,
    execute,
  } as T;
}

async function logToolRun(input: { userId: string; conversationId?: string | null; projectId?: string | null; workflowId?: string | null; requestId?: string | null; executionAttemptId?: string | null; toolName: string; risk: ToolRisk; status: 'success' | 'error' | 'blocked'; attempt: number; inputHash: string; durationMs?: number; error?: string; blockedReason?: string }) {
  try {
    await withTransaction(async (client) => {
      await assertExecutionAttemptCorrelation(client, {
        userId: input.userId,
        conversationId: input.conversationId,
        workflowId: input.workflowId,
        executionAttemptId: input.executionAttemptId,
      });
      await client.query(
        `insert into tool_runs (user_id, conversation_id, project_id, workflow_id, request_id, execution_attempt_id, tool_name, risk, status, attempt, input_hash, blocked_reason, duration_ms, error_message)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [input.userId, input.conversationId ?? null, input.projectId ?? null, input.workflowId ?? null, input.requestId ?? null, input.executionAttemptId ?? null, input.toolName, input.risk, input.status, input.attempt, input.inputHash, input.blockedReason ?? null, input.durationMs ?? 0, input.error ?? null],
      );
    });
  } catch {
    // Observability must never break the user's request.
  }
}

export function createToolEngine(user: { id: string; plan: 'free' | 'premium'; memoryEnabled?: boolean }, context: { projectId?: string | null; conversationId?: string | null; workflowId?: string | null; requestId?: string | null; executionAttemptId?: string | null; requestText: string; onExternalSources?: (sources: ExternalSourceSnapshot[]) => void }) {
  const memoryTools = user.memoryEnabled === false ? {} : createMemoryTools(user, context.projectId);
  const artifactTools = createArtifactTools(user, { projectId: context.projectId, conversationId: context.conversationId });
  const workflowTools = createWorkflowTools(user, context.workflowId, context.projectId);
  const projectTools = context.projectId ? createProjectIntelligenceTools(user, context.projectId) : {};
  const projectFileTools = context.projectId ? createProjectFileTools(user, context.projectId) : {};
  const selectedNames = selectToolNames(context.requestText, { projectActive: Boolean(context.projectId), memoryEnabled: user.memoryEnabled !== false });

  const rawTools: ToolSet = {
    tako_search: gateway.tools.takoSearch(),
    calculator: calculatorTool,
    ...memoryTools,
    ...artifactTools,
    ...workflowTools,
    ...projectTools,
    ...projectFileTools,
  };

  const output: ToolSet = {};
  const budget: ToolBudget = { total: 0, write: 0, external: 0 };
  for (const name of selectedNames) {
    const raw = rawTools[name];
    if (!raw) continue;
    const descriptor = TOOL_REGISTRY.find((item) => item.name === name);
    if (!descriptor) continue;
    if (descriptor.requiresExplicitIntent && !hasWriteIntent(context.requestText, descriptor)) continue;
    output[name] = withRecovery(name, raw as any, { userId: user.id, conversationId: context.conversationId, projectId: context.projectId, workflowId: context.workflowId, requestId: context.requestId, executionAttemptId: context.executionAttemptId, onExternalSources: context.onExternalSources }, budget);
  }

  return { tools: output, selectedNames: Object.keys(output) };
}
