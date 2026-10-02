import { query, withTransaction } from '@/lib/db';
import type { PoolClient } from 'pg';

export type MemoryScope = 'saved' | 'project';
export type MemoryKind = 'fact' | 'preference' | 'instruction' | 'knowledge';

export class MemoryConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Memory has changed since it was loaded.');
    this.name = 'MemoryConflictError';
  }
}

export type Memory = {
  id: string;
  project_id: string | null;
  scope: MemoryScope;
  kind: MemoryKind;
  label: string;
  content: string;
  source_conversation_id: string | null;
  importance: number;
  version: number;
  created_at: string;
  updated_at: string;
};

export function getMemoryLimit(plan: 'free' | 'premium') {
  return plan === 'premium' ? 200 : 25;
}

function normalizeText(value: unknown, max: number) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export async function listMemories(userId: string, options: { scope?: MemoryScope; projectId?: string | null } = {}) {
  const conditions = ['user_id = $1'];
  const values: unknown[] = [userId];

  if (options.scope) {
    values.push(options.scope);
    conditions.push(`scope = $${values.length}`);
  }
  if (options.projectId) {
    values.push(options.projectId);
    conditions.push(`project_id = $${values.length}`);
  } else if (options.scope === 'saved') {
    conditions.push('project_id is null');
  }

  const result = await query<Memory>(
    `select id, project_id, scope, kind, label, content, source_conversation_id, importance, version, created_at, updated_at
     from memories
     where ${conditions.join(' and ')}
     order by importance desc, updated_at desc
     limit 200`,
    values,
  );
  return result.rows;
}

export async function searchMemories(userId: string, queryText: string, projectId?: string | null, limit = 8) {
  const text = normalizeText(queryText, 500);
  if (!text) return [] as Memory[];

  const values: unknown[] = [userId, text];
  const projectClause = projectId
    ? `(scope = 'saved' and project_id is null) or (scope = 'project' and project_id = $3)`
    : `scope = 'saved' and project_id is null`;
  if (projectId) values.push(projectId);

  const result = await query<Memory>(
    `select id, project_id, scope, kind, label, content, source_conversation_id, importance, version, created_at, updated_at
     from memories
     where user_id = $1
       and (${projectClause})
       and to_tsvector('simple', coalesce(label, '') || ' ' || content) @@ websearch_to_tsquery('simple', $2)
     order by ts_rank_cd(to_tsvector('simple', coalesce(label, '') || ' ' || content), websearch_to_tsquery('simple', $2)) desc,
              importance desc,
              updated_at desc
     limit ${Math.max(1, Math.min(20, limit))}`,
    values,
  );

  return result.rows;
}

export async function createMemory(params: {
  userId: string;
  plan: 'free' | 'premium';
  scope: MemoryScope;
  kind?: MemoryKind;
  label?: string;
  content: string;
  projectId?: string | null;
  sourceConversationId?: string | null;
  importance?: number;
  client?: PoolClient;
}) {
  const content = normalizeText(params.content, 1200);
  const label = normalizeText(params.label, 120);
  const kind = params.kind ?? 'fact';
  if (!['fact', 'preference', 'instruction', 'knowledge'].includes(kind)) throw new Error('Unsupported memory kind.');
  const numericImportance = Number(params.importance ?? 3);
  if (!Number.isFinite(numericImportance)) throw new Error('Memory importance must be a number.');
  const importance = Math.max(1, Math.min(5, numericImportance));

  if (!content) throw new Error('Memory content is required.');
  if (params.scope === 'project' && !params.projectId) throw new Error('Project memory requires a project.');

  const create = async (client: PoolClient) => {
    await client.query('select id from users where id = $1 for update', [params.userId]);
    const count = await client.query<{ count: string }>(
      `select count(*)::text as count from memories where user_id = $1 and scope = $2`,
      [params.userId, params.scope],
    );
    if (Number(count.rows[0]?.count ?? 0) >= getMemoryLimit(params.plan)) {
      throw new Error(`Your ${params.plan} memory limit has been reached.`);
    }

    if (params.projectId) {
      const owned = await client.query('select id from projects where id = $1 and user_id = $2 limit 1', [params.projectId, params.userId]);
      if (!owned.rows[0]) throw new Error('Project not found.');
    }

    if (params.sourceConversationId) {
      const conversation = await client.query<{ id: string; project_id: string | null }>(
        'select id, project_id from conversations where id = $1 and user_id = $2 limit 1',
        [params.sourceConversationId, params.userId],
      );
      if (!conversation.rows[0]) throw new Error('Source conversation not found.');
      if (params.scope === 'project' && conversation.rows[0].project_id !== params.projectId) {
        throw new Error('Source conversation does not belong to that project.');
      }
    }

    const result = await client.query<Memory>(
      `insert into memories (user_id, project_id, scope, kind, label, content, source_conversation_id, importance)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, project_id, scope, kind, label, content, source_conversation_id, importance, version, created_at, updated_at`,
      [params.userId, params.scope === 'saved' ? null : params.projectId, params.scope, kind, label, content, params.sourceConversationId ?? null, importance],
    );
    const memory = result.rows[0];
    await client.query(`insert into memory_events (user_id, memory_id, action) values ($1, $2, 'create')`, [params.userId, memory.id]);
    return memory;
  };

  return params.client ? create(params.client) : withTransaction(create);
}

export async function updateMemory(userId: string, id: string, patch: { label?: string; content?: string; kind?: MemoryKind; importance?: number; expectedVersion?: number }) {
  return withTransaction(async (client) => {
    const current = await client.query<Memory>(
      `select id, project_id, scope, kind, label, content, source_conversation_id, importance, version, created_at, updated_at
       from memories where id = $1 and user_id = $2 for update`,
      [id, userId],
    );
    if (!current.rows[0]) throw new Error('Memory not found.');

    const memory = current.rows[0];
    if (patch.expectedVersion !== undefined && patch.expectedVersion !== memory.version) {
      throw new MemoryConflictError(memory.version);
    }
    const nextLabel = patch.label === undefined ? memory.label : normalizeText(patch.label, 120);
    const nextContent = patch.content === undefined ? memory.content : normalizeText(patch.content, 1200);
    const nextKind = patch.kind === undefined ? memory.kind : patch.kind;
    if (!['fact', 'preference', 'instruction', 'knowledge'].includes(nextKind)) throw new Error('Unsupported memory kind.');
    const numericImportance = patch.importance === undefined ? memory.importance : Number(patch.importance);
    if (!Number.isFinite(numericImportance)) throw new Error('Memory importance must be a number.');
    const nextImportance = Math.max(1, Math.min(5, numericImportance));
    if (!nextContent) throw new Error('Memory content is required.');

    const result = await client.query<Memory>(
      `update memories set label = $1, content = $2, kind = $3, importance = $4, version = version + 1, updated_at = now()
       where id = $5 and user_id = $6 and version = $7
       returning id, project_id, scope, kind, label, content, source_conversation_id, importance, version, created_at, updated_at`,
      [nextLabel, nextContent, nextKind, nextImportance, id, userId, memory.version],
    );
    if (!result.rows[0]) {
      const latest = await client.query<{ version: number }>('select version from memories where id = $1 and user_id = $2 limit 1', [id, userId]);
      throw new MemoryConflictError(Number(latest.rows[0]?.version ?? memory.version));
    }
    await client.query(`insert into memory_events (user_id, memory_id, action) values ($1, $2, 'update')`, [userId, id]);
    return result.rows[0];
  });
}

export async function deleteMemory(userId: string, id: string, projectId?: string | null) {
  return withTransaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      `select id, scope, project_id from memories
       where id = $1 and user_id = $2
         and ($3::uuid is null or scope = 'saved' or project_id = $3::uuid)
       for update`,
      [id, userId, projectId ?? null],
    );
    if (!existing.rows[0]) throw new Error('Memory not found.');
    await client.query(`insert into memory_events (user_id, memory_id, action) values ($1, $2, 'delete')`, [userId, id]);
    await client.query(`delete from memories where id = $1 and user_id = $2`, [id, userId]);
    return true;
  });
}

export async function buildMemoryContext(userId: string, queryText: string, projectId?: string | null) {
  const memories = await searchMemories(userId, queryText, projectId, 8);
  const project = projectId
    ? await query<{ name: string; description: string }>(
        `select name, description from projects where id = $1 and user_id = $2 limit 1`,
        [projectId, userId],
      )
    : null;

  const projectContext = project?.rows[0]
    ? `Project: ${project.rows[0].name}\n${project.rows[0].description || 'No project description.'}`
    : 'No active project.';

  const memoryContext = memories.length
    ? memories.map((memory) => `[${memory.scope}/${memory.kind}] ${memory.label ? `${memory.label}: ` : ''}${memory.content}`).join('\n')
    : 'No relevant saved or project memory was found.';

  return { projectContext, memoryContext, memories };
}
