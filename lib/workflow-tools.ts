import { jsonSchema, tool, type ToolSet } from 'ai';
import { getArtifact } from '@/lib/artifacts';
import { getWorkflow } from '@/lib/workflows';
import { getNextCheckpoint, consumeCheckpoint, listCheckpoints } from '@/lib/agent-checkpoints';

const verifySchema = {
  type: 'object',
  properties: {
    workflowId: { type: 'string', description: 'The active workflow ID.' },
    artifactId: { type: 'string', description: 'Optional artifact ID to verify.' },
    requirement: { type: 'string', description: 'Short description of what should be verified.' },
  },
  required: ['workflowId', 'requirement'],
  additionalProperties: false,
} as const;

export function createWorkflowTools(user: { id: string }, workflowId?: string | null, projectId?: string | null): ToolSet {
  if (!workflowId) return {};

  return {
    checkpoint_status: tool({
      title: 'Inspect workflow checkpoints',
      description: 'Inspect resumable agent checkpoints for the active workflow before continuing or recovering work.',
      inputSchema: jsonSchema<Record<string, never>>({
        type: 'object',
        properties: {},
        additionalProperties: false,
      }),
      execute: async () => {
        const activeWorkflow = await getWorkflow(user.id, workflowId, projectId);
        if (!activeWorkflow) return { workflowId, next: null, checkpoints: [], error: 'Workflow does not belong to the active project.' };
        const checkpoints = await listCheckpoints(user.id, workflowId);
        const next = await getNextCheckpoint(user.id, workflowId);
        return { workflowId, next, checkpoints };
      },
    }),
    resume_checkpoint: tool({
      title: 'Resume from checkpoint',
      description: 'Consume the next resumable checkpoint and return its saved state so the agent can continue without repeating completed work.',
      inputSchema: jsonSchema<Record<string, never>>({
        type: 'object',
        properties: {},
        additionalProperties: false,
      }),
      execute: async () => {
        const activeWorkflow = await getWorkflow(user.id, workflowId, projectId);
        if (!activeWorkflow) return { resumed: false, reason: 'Workflow does not belong to the active project.' };
        const next = await getNextCheckpoint(user.id, workflowId);
        if (!next) return { resumed: false, reason: 'No resumable checkpoint is available.' };
        if (next.status === 'blocked') {
          return { resumed: false, blocked: true, reason: next.last_error || 'Manual intervention is required before this checkpoint can be resumed.', checkpoint: next };
        }
        const consumed = await consumeCheckpoint(user.id, next.id);
        return { resumed: Boolean(consumed), checkpoint: consumed ?? next }; 
      },
    }),
    verify_workflow: tool({
      title: 'Verify workflow output',
      description: 'Perform a final structural verification of the active workflow and any specified artifact. Use before the final answer on complex tasks.',
      inputSchema: jsonSchema<Record<string, unknown>>(verifySchema),
      execute: async (input) => {
        const value = input as Record<string, unknown>;
        const requestedWorkflowId = String(value.workflowId ?? workflowId);
        if (requestedWorkflowId !== workflowId) return { verified: false, error: 'Workflow ID mismatch.' };
        const workflow = await getWorkflow(user.id, workflowId, projectId);
        if (!workflow) return { verified: false, error: 'Workflow not found.' };

        const checks = [
          { check: 'workflow_exists', passed: true },
          { check: 'plan_present', passed: workflow.steps.length > 0 },
          { check: 'request_present', passed: workflow.request.length > 0 },
        ];

        let artifactCheck: { check: string; passed: boolean; details?: unknown } | null = null;
        if (value.artifactId) {
          const artifact = await getArtifact(user.id, String(value.artifactId), projectId);
          artifactCheck = {
            check: 'artifact_ready',
            passed: Boolean(artifact && artifact.content.trim()),
            details: artifact ? { title: artifact.title, version: artifact.version, filename: artifact.filename } : null,
          };
          checks.push(artifactCheck);
        }

        return {
          verified: checks.every((check) => check.passed),
          requirement: String(value.requirement),
          checks,
        };
      },
    }),
  };
}
