import { jsonSchema, tool } from 'ai';
import { createMemory, deleteMemory, searchMemories } from '@/lib/memory';

const querySchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'What you want to retrieve from NEXA memory.' },
  },
  required: ['query'],
  additionalProperties: false,
} as const;

const saveSchema = {
  type: 'object',
  properties: {
    content: { type: 'string', description: 'A durable fact, preference, instruction, or project knowledge explicitly requested by the user.' },
    scope: { type: 'string', enum: ['saved', 'project'] },
    kind: { type: 'string', enum: ['fact', 'preference', 'instruction', 'knowledge'] },
    label: { type: 'string' },
    importance: { type: 'number', minimum: 1, maximum: 5 },
  },
  required: ['content', 'scope'],
  additionalProperties: false,
} as const;

const updateVersionNote = 'When updating a memory through the API, use its current version to prevent silent concurrent overwrites.';

const forgetSchema = {
  type: 'object',
  properties: {
    memoryId: { type: 'string', description: 'The memory ID returned by a previous search_memory call.' },
  },
  required: ['memoryId'],
  additionalProperties: false,
} as const;

export function createMemoryTools(user: { id: string; plan: 'free' | 'premium'; memoryEnabled?: boolean }, projectId?: string | null) {
  const memoryEnabled = user.memoryEnabled !== false;
  const disabled = () => ({ error: 'Memory is disabled for this account.' });
  return {
    search_memory: tool({
      title: 'Search memory',
      description: 'Search the user’s saved memory and, when a project is active, relevant project memory. Use this before making personalization assumptions.',
      inputSchema: jsonSchema<Record<string, unknown>>(querySchema),
      execute: async (input) => {
        if (!memoryEnabled) return disabled();
        const queryText = typeof input === 'object' && input && 'query' in input ? String(input.query) : '';
        const rows = await searchMemories(user.id, queryText, projectId, 8);
        return { memories: rows.map((row) => ({ id: row.id, scope: row.scope, kind: row.kind, label: row.label, content: row.content, projectId: row.project_id })) };
      },
    }),
    save_memory: tool({
      title: 'Save memory',
      description: 'Save something only when the user explicitly asks NEXA to remember, save, keep, or retain it. Do not save sensitive information unless the user clearly asks and it is appropriate.',
      inputSchema: jsonSchema<Record<string, unknown>>(saveSchema),
      execute: async (input) => {
        if (!memoryEnabled) return disabled();
        const value = input as Record<string, unknown>;
        const scope = value.scope === 'project' ? 'project' : 'saved';
        const memory = await createMemory({
          userId: user.id,
          plan: user.plan,
          scope,
          kind: value.kind as 'fact' | 'preference' | 'instruction' | 'knowledge' | undefined,
          label: String(value.label ?? ''),
          content: String(value.content ?? ''),
          projectId: scope === 'project' ? projectId : null,
          importance: Number(value.importance ?? 3),
        });
        return { saved: true, memory: { id: memory.id, scope: memory.scope, kind: memory.kind, label: memory.label, content: memory.content } };
      },
    }),
    forget_memory: tool({
      title: 'Forget memory',
      description: 'Delete a memory only when the user asks NEXA to forget or remove it, or when the user identifies a specific memory to delete.',
      inputSchema: jsonSchema<Record<string, unknown>>(forgetSchema),
      execute: async (input) => {
        if (!memoryEnabled) return disabled();
        const value = input as Record<string, unknown>;
        await deleteMemory(user.id, String(value.memoryId ?? ''), projectId);
        return { deleted: true, memoryId: String(value.memoryId ?? '') };
      },
    }),
  };
}
