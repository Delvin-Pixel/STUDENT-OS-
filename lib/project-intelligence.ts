import { query } from '@/lib/db';
import { searchMemories, type Memory } from '@/lib/memory';
import { searchSemanticProjectFiles } from '@/lib/project-semantic';
import { MAX_ASSISTANT_MESSAGE_SOURCES, type AssistantMessageSourceSnapshot } from '@/lib/message-sources';

export type ProjectContextResult = {
  id: string;
  source: 'conversation' | 'artifact' | 'memory' | 'workflow' | 'file';
  title: string;
  excerpt: string;
  relevance: number;
  updatedAt: string;
  conversationId?: string | null;
  artifactId?: string | null;
  memoryId?: string | null;
  workflowId?: string | null;
  fileId?: string | null;
  retrieval?: 'lexical' | 'semantic' | 'hybrid';
};

const MAX_CONTEXT_CHARS = 8_000;

function normalizeQuery(value: unknown, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function excerpt(value: string, max = 1_700) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`;
}

function scoreWithRecency(rank: number, updatedAt: string, sourceWeight: number) {
  const ageDays = Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
  const recency = 1 / (1 + ageDays / 14);
  return Number((sourceWeight + rank * 2 + recency).toFixed(4));
}

async function searchProjectConversations(userId: string, projectId: string, queryText: string, limit: number): Promise<ProjectContextResult[]> {
  const result = await query<{
    id: string;
    conversation_id: string;
    title: string;
    role: string;
    content: string;
    updated_at: string;
    rank: number;
  }>(
    `select m.id,
            c.id as conversation_id,
            c.title,
            m.role,
            m.content,
            greatest(c.updated_at, m.created_at) as updated_at,
            ts_rank_cd(to_tsvector('simple', m.content), websearch_to_tsquery('simple', $3)) as rank
     from messages m
     join conversations c on c.id = m.conversation_id
     where c.user_id = $1
       and c.project_id = $2
       and to_tsvector('simple', m.content) @@ websearch_to_tsquery('simple', $3)
     order by rank desc, updated_at desc
     limit $4`,
    [userId, projectId, queryText, limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    source: 'conversation' as const,
    title: row.title,
    excerpt: `[${row.role}] ${excerpt(row.content)}`,
    relevance: scoreWithRecency(Number(row.rank ?? 0), row.updated_at, row.role === 'user' ? 2.2 : 2),
    updatedAt: row.updated_at,
    conversationId: row.conversation_id,
  }));
}

async function searchProjectArtifacts(userId: string, projectId: string, queryText: string, limit: number): Promise<ProjectContextResult[]> {
  const result = await query<{
    id: string;
    title: string;
    filename: string;
    artifact_type: string;
    content: string;
    updated_at: string;
    rank: number;
  }>(
    `select id,
            title,
            filename,
            artifact_type,
            content,
            updated_at,
            ts_rank_cd(
              to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(filename, '') || ' ' || coalesce(content, '')),
              websearch_to_tsquery('simple', $3)
            ) as rank
     from artifacts
     where user_id = $1
       and project_id = $2
       and to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(filename, '') || ' ' || coalesce(content, '')) @@ websearch_to_tsquery('simple', $3)
     order by rank desc, updated_at desc
     limit $4`,
    [userId, projectId, queryText, limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    source: 'artifact' as const,
    title: `${row.title} (${row.filename})`,
    excerpt: `[${row.artifact_type}] ${excerpt(row.content)}`,
    relevance: scoreWithRecency(Number(row.rank ?? 0), row.updated_at, 2.4),
    updatedAt: row.updated_at,
    artifactId: row.id,
  }));
}


async function searchProjectFiles(userId: string, projectId: string, queryText: string, limit: number): Promise<ProjectContextResult[]> {
  const result = await query<{
    id: string;
    filename: string;
    media_type: string;
    content: string;
    updated_at: string;
    rank: number;
  }>(
    `select id,
            filename,
            media_type,
            content,
            updated_at,
            ts_rank_cd(
              to_tsvector('simple', coalesce(filename, '') || ' ' || content),
              websearch_to_tsquery('simple', $3)
            ) as rank
     from project_files
     where user_id = $1
       and project_id = $2
       and to_tsvector('simple', coalesce(filename, '') || ' ' || content) @@ websearch_to_tsquery('simple', $3)
     order by rank desc, updated_at desc
     limit $4`,
    [userId, projectId, queryText, limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    source: 'file' as const,
    title: row.filename,
    excerpt: `[${row.media_type}] ${excerpt(row.content)}`,
    relevance: scoreWithRecency(Number(row.rank ?? 0), row.updated_at, 2.6),
    updatedAt: row.updated_at,
    fileId: row.id,
    retrieval: 'lexical' as const,
  }));
}


async function searchSemanticFiles(userId: string, projectId: string, queryText: string, limit: number): Promise<ProjectContextResult[]> {
  const matches = await searchSemanticProjectFiles(userId, projectId, queryText, limit);
  return matches.map((match) => ({
    id: match.id,
    source: 'file' as const,
    title: match.filename,
    excerpt: `[${match.mediaType}/semantic] ${excerpt(match.excerpt)}`,
    relevance: scoreWithRecency(match.similarity, match.updatedAt, 2.5),
    updatedAt: match.updatedAt,
    fileId: match.id,
    retrieval: 'semantic' as const,
  }));
}

function mergeProjectFileResults(lexical: ProjectContextResult[], semantic: ProjectContextResult[]) {
  const merged = new Map<string, ProjectContextResult>();
  for (const item of lexical) merged.set(item.id, item);
  for (const item of semantic) {
    const current = merged.get(item.id);
    if (!current) {
      merged.set(item.id, item);
      continue;
    }
    merged.set(item.id, {
      ...current,
      excerpt: item.excerpt,
      relevance: Number((Math.max(current.relevance, item.relevance) + 0.35).toFixed(4)),
      retrieval: 'hybrid',
    });
  }
  return [...merged.values()];
}

async function searchProjectWorkflows(userId: string, projectId: string, queryText: string, limit: number): Promise<ProjectContextResult[]> {
  const result = await query<{
    id: string;
    title: string;
    request: string;
    status: string;
    result_summary: string | null;
    updated_at: string;
  }>(
    `select id, title, request, status, result_summary, updated_at
     from workflows
     where user_id = $1
       and project_id = $2
       and (
         to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(request, '') || ' ' || coalesce(result_summary, ''))
         @@ websearch_to_tsquery('simple', $3)
         or status in ('queued', 'running', 'verifying')
       )
     order by (status in ('queued', 'running', 'verifying')) desc, updated_at desc
     limit $4`,
    [userId, projectId, queryText, limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    source: 'workflow' as const,
    title: row.title,
    excerpt: `[${row.status}] ${excerpt(row.result_summary || row.request)}`,
    relevance: scoreWithRecency(row.status === 'completed' ? 0.4 : 1.2, row.updated_at, 1.8),
    updatedAt: row.updated_at,
    workflowId: row.id,
  }));
}

async function recentProjectConversations(userId: string, projectId: string, limit: number): Promise<ProjectContextResult[]> {
  const result = await query<{
    id: string;
    title: string;
    updated_at: string;
  }>(
    `select id, title, updated_at
     from conversations
     where user_id = $1 and project_id = $2
     order by updated_at desc
     limit $3`,
    [userId, projectId, limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    source: 'conversation' as const,
    title: row.title,
    excerpt: 'Recent project conversation. Retrieve the conversation messages when exact details are needed.',
    relevance: scoreWithRecency(0.1, row.updated_at, 1.2),
    updatedAt: row.updated_at,
    conversationId: row.id,
  }));
}

async function getProjectProfile(userId: string, projectId: string) {
  const result = await query<{ id: string; name: string; description: string; updated_at: string }>(
    `select id, name, description, updated_at from projects where id = $1 and user_id = $2 limit 1`,
    [projectId, userId],
  );
  return result.rows[0] ?? null;
}

async function getRecentWorkflowState(userId: string, projectId: string) {
  const result = await query<{
    id: string;
    title: string;
    status: string;
    result_summary: string | null;
    updated_at: string;
  }>(
    `select id, title, status, result_summary, updated_at
     from workflows
     where user_id = $1 and project_id = $2
     order by updated_at desc
     limit 3`,
    [userId, projectId],
  );
  return result.rows;
}

export async function retrieveProjectContext(userId: string, projectId: string, queryText: string, options: { limit?: number; includeMemory?: boolean } = {}) {
  const text = normalizeQuery(queryText);
  const limit = Math.max(1, Math.min(12, options.limit ?? 8));
  const includeMemory = options.includeMemory !== false;
  const profile = await getProjectProfile(userId, projectId);
  if (!profile) throw new Error('Project not found.');

  const [conversationResults, artifactResults, fileResults, semanticFileResults, workflowResults, memories, recentWorkflows] = await Promise.all([
    text ? searchProjectConversations(userId, projectId, text, Math.ceil(limit * 0.75)) : Promise.resolve([] as ProjectContextResult[]),
    text ? searchProjectArtifacts(userId, projectId, text, Math.ceil(limit * 0.5)) : Promise.resolve([] as ProjectContextResult[]),
    text ? searchProjectFiles(userId, projectId, text, Math.ceil(limit * 0.6)) : Promise.resolve([] as ProjectContextResult[]),
    text ? searchSemanticFiles(userId, projectId, text, Math.ceil(limit * 0.75)) : Promise.resolve([] as ProjectContextResult[]),
    text ? searchProjectWorkflows(userId, projectId, text, Math.ceil(limit * 0.35)) : Promise.resolve([] as ProjectContextResult[]),
    includeMemory
      ? searchMemories(userId, text || profile.name, projectId, Math.min(8, limit))
      : Promise.resolve([]),
    getRecentWorkflowState(userId, projectId),
  ]);

  const combinedFileResults = mergeProjectFileResults(fileResults, semanticFileResults);
  let items: ProjectContextResult[] = [...conversationResults, ...artifactResults, ...combinedFileResults, ...workflowResults];
  if (!items.length) items = await recentProjectConversations(userId, projectId, Math.min(5, limit));
  items.sort((a, b) => b.relevance - a.relevance || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  items = items.slice(0, limit);

  const memoryItems: ProjectContextResult[] = memories.map((memory: Memory) => ({
    id: memory.id,
    source: 'memory' as const,
    title: memory.label || `${memory.scope} ${memory.kind}`,
    excerpt: `[${memory.scope}/${memory.kind}] ${excerpt(memory.content, 1_300)}`,
    relevance: scoreWithRecency(memory.importance / 5, memory.updated_at, 2.1),
    updatedAt: memory.updated_at,
    memoryId: memory.id,
  }));

  const groundingSources: AssistantMessageSourceSnapshot[] = [...items, ...memoryItems]
    .sort((a, b) => b.relevance - a.relevance || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_ASSISTANT_MESSAGE_SOURCES)
    .map((item, index) => ({
      label: `S${index + 1}`,
      sourceType: item.source,
      sourceId: item.id || null,
      title: item.title,
      excerpt: excerpt(item.excerpt, 1_100),
      retrieval: item.retrieval ?? null,
      relevance: Number.isFinite(item.relevance) ? item.relevance : null,
      sourceUpdatedAt: item.updatedAt || null,
    }));

  const blocks: string[] = [
    `Project: ${profile.name}\n${profile.description || 'No project description.'}`,
  ];
  if (groundingSources.length) {
    blocks.push(`Grounding sources (cite these exact labels inline when you rely on them; never invent a label):\n${groundingSources.map((source) => `- [${source.label}] ${source.title}${source.retrieval ? ` [${source.retrieval}]` : ''}: ${source.excerpt}`).join('\n')}`);
  }
  if (recentWorkflows.length) {
    blocks.push(`Recent workflow state:\n${recentWorkflows.map((workflow) => `- ${workflow.title} — ${workflow.status}${workflow.result_summary ? ` — ${excerpt(workflow.result_summary, 500)}` : ''}`).join('\n')}`);
  }

  return {
    profile,
    items,
    memories: memoryItems,
    recentWorkflows,
    sources: groundingSources,
    promptContext: blocks.join('\n\n').slice(0, MAX_CONTEXT_CHARS),
  };
}
