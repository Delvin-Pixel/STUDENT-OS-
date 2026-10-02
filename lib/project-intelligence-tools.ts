import { jsonSchema, tool, type ToolSet } from 'ai';
import { retrieveProjectContext } from '@/lib/project-intelligence';

const querySchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'What you need to retrieve from the active project: prior decisions, conversations, files, artifacts, workflows, or project knowledge.' },
    limit: { type: 'number', minimum: 1, maximum: 12 },
  },
  required: ['query'],
  additionalProperties: false,
} as const;

export function createProjectIntelligenceTools(user: { id: string; memoryEnabled?: boolean }, projectId?: string | null): ToolSet {
  if (!projectId) return {};
  return {
    search_project: tool({
      title: 'Search project context',
      description: 'Search the active project across relevant conversations, project files, artifacts, project memory, and workflow state. Use this when exact project history or prior decisions matter.',
      inputSchema: jsonSchema<Record<string, unknown>>(querySchema),
      execute: async (input) => {
        const value = input as Record<string, unknown>;
        const result = await retrieveProjectContext(user.id, projectId, String(value.query ?? ''), { limit: Number(value.limit ?? 8), includeMemory: user.memoryEnabled !== false });
        return {
          project: result.profile,
          sources: result.items.map((item) => ({
            source: item.source,
            title: item.title,
            excerpt: item.excerpt,
            relevance: item.relevance,
            retrieval: item.retrieval ?? null,
            conversationId: item.conversationId ?? null,
            artifactId: item.artifactId ?? null,
            workflowId: item.workflowId ?? null,
            memoryId: item.memoryId ?? null,
            fileId: item.fileId ?? null,
          })),
          recentWorkflows: result.recentWorkflows,
        };
      },
    }),
  };
}
