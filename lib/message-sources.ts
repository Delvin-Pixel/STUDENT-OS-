import type { PoolClient } from 'pg';

export const MAX_ASSISTANT_MESSAGE_SOURCES = 12;

export type AssistantMessageSourceSnapshot = {
  label: string;
  sourceType: 'conversation' | 'artifact' | 'memory' | 'workflow' | 'file';
  sourceId: string | null;
  title: string;
  excerpt: string;
  retrieval: 'lexical' | 'semantic' | 'hybrid' | null;
  relevance: number | null;
  sourceUpdatedAt: string | null;
};

function bounded(value: unknown, max: number) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function persistAssistantMessageSources(
  client: PoolClient,
  params: {
    messageId: string;
    conversationId: string;
    userId: string;
    projectId?: string | null;
    sources: AssistantMessageSourceSnapshot[];
  },
) {
  const sources = params.sources.slice(0, MAX_ASSISTANT_MESSAGE_SOURCES);
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const label = `S${index + 1}`;
    const title = bounded(source.title, 300) || `${source.sourceType} source`;
    const excerpt = bounded(source.excerpt, 1200) || 'Retrieved project evidence.';
    await client.query(
      `insert into assistant_message_sources
         (message_id, conversation_id, user_id, project_id, source_order, source_label, source_type, source_id,
          title, excerpt, retrieval, relevance, source_updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::uuid, $9, $10, $11, $12, $13::timestamptz)
       on conflict (message_id, source_order) do nothing`,
      [
        params.messageId,
        params.conversationId,
        params.userId,
        params.projectId ?? null,
        index + 1,
        label,
        source.sourceType,
        source.sourceId,
        title,
        excerpt,
        source.retrieval,
        source.relevance,
        source.sourceUpdatedAt,
      ],
    );
  }
}
