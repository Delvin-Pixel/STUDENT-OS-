import { jsonSchema, tool } from 'ai';
import { createArtifact, getArtifact, listArtifacts, updateArtifact } from '@/lib/artifacts';

const createSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Human-readable artifact title.' },
    type: { type: 'string', enum: ['document', 'report', 'code', 'data', 'note'] },
    content: { type: 'string', description: 'Complete artifact contents. The artifact should be usable without the surrounding chat.' },
    filename: { type: 'string', description: 'Optional filename such as study-plan.md, app.tsx, or analysis.json.' },
    language: { type: 'string', description: 'Optional programming or markup language for code artifacts.' },
    mimeType: { type: 'string', description: 'Optional MIME type. Usually inferred from filename.' },
  },
  required: ['title', 'type', 'content'],
  additionalProperties: false,
} as const;

const updateSchema = {
  type: 'object',
  properties: {
    artifactId: { type: 'string', description: 'Artifact ID returned by list_artifacts or get_artifact.' },
    title: { type: 'string' },
    content: { type: 'string' },
    filename: { type: 'string' },
    language: { type: 'string' },
    mimeType: { type: 'string' },
    expectedVersion: { type: 'number', minimum: 1 },
  },
  required: ['artifactId'],
  additionalProperties: false,
} as const;

const listSchema = {
  type: 'object',
  properties: {
    projectOnly: { type: 'boolean', description: 'When true, limit results to the active project.' },
    limit: { type: 'number', minimum: 1, maximum: 20 },
  },
  additionalProperties: false,
} as const;

const getSchema = {
  type: 'object',
  properties: {
    artifactId: { type: 'string' },
  },
  required: ['artifactId'],
  additionalProperties: false,
} as const;

export function createArtifactTools(user: { id: string; plan: 'free' | 'premium' }, context?: { projectId?: string | null; conversationId?: string | null }) {
  return {
    create_artifact: tool({
      title: 'Create artifact',
      description: 'Create a durable project file when the user asks for a document, report, code file, note, JSON/CSV dataset, or other reusable deliverable. Do not create artifacts for ordinary conversational answers.',
      inputSchema: jsonSchema<Record<string, unknown>>(createSchema),
      execute: async (input) => {
        const value = input as Record<string, unknown>;
        const artifact = await createArtifact({
          userId: user.id,
          plan: user.plan,
          projectId: context?.projectId ?? null,
          conversationId: context?.conversationId ?? null,
          title: String(value.title ?? ''),
          type: value.type as 'document' | 'report' | 'code' | 'data' | 'note',
          content: String(value.content ?? ''),
          filename: value.filename ? String(value.filename) : null,
          language: value.language ? String(value.language) : null,
          mimeType: value.mimeType ? String(value.mimeType) : null,
        });
        return {
          created: true,
          artifact: {
            id: artifact.id,
            title: artifact.title,
            filename: artifact.filename,
            type: artifact.artifact_type,
            version: artifact.version,
          },
        };
      },
    }),
    list_artifacts: tool({
      title: 'List artifacts',
      description: 'List durable artifacts belonging to the user, especially the active project when one exists.',
      inputSchema: jsonSchema<Record<string, unknown>>(listSchema),
      execute: async (input) => {
        const value = input as Record<string, unknown>;
        const projectOnly = Boolean(context?.projectId) ? true : Boolean(value.projectOnly ?? false);
        const artifacts = await listArtifacts(user.id, {
          projectId: projectOnly ? context?.projectId ?? null : null,
          limit: Number(value.limit ?? 12),
        });
        return { artifacts: artifacts.map((artifact) => ({ id: artifact.id, title: artifact.title, filename: artifact.filename, type: artifact.artifact_type, version: artifact.version, updatedAt: artifact.updated_at })) };
      },
    }),
    get_artifact: tool({
      title: 'Get artifact',
      description: 'Read a durable artifact before modifying it or answering a question about its exact contents.',
      inputSchema: jsonSchema<Record<string, unknown>>(getSchema),
      execute: async (input) => {
        const value = input as Record<string, unknown>;
        const artifact = await getArtifact(user.id, String(value.artifactId ?? ''), context?.projectId);
        if (!artifact) return { error: 'Artifact not found.' };
        return { artifact: { id: artifact.id, title: artifact.title, filename: artifact.filename, type: artifact.artifact_type, language: artifact.language, content: artifact.content, version: artifact.version } };
      },
    }),
    update_artifact: tool({
      title: 'Update artifact',
      description: 'Update an existing durable artifact after the user asks to revise, correct, extend, or replace it. Read it first when exact content matters.',
      inputSchema: jsonSchema<Record<string, unknown>>(updateSchema),
      execute: async (input) => {
        const value = input as Record<string, unknown>;
        const artifact = await updateArtifact(user.id, user.plan, String(value.artifactId ?? ''), {
          title: value.title === undefined ? undefined : String(value.title),
          content: value.content === undefined ? undefined : String(value.content),
          filename: value.filename === undefined ? undefined : String(value.filename),
          language: value.language === undefined ? undefined : String(value.language),
          mimeType: value.mimeType === undefined ? undefined : String(value.mimeType),
          expectedVersion: value.expectedVersion === undefined ? undefined : Number(value.expectedVersion),
        }, context?.projectId);
        return { updated: true, artifact: { id: artifact.id, title: artifact.title, filename: artifact.filename, type: artifact.artifact_type, version: artifact.version } };
      },
    }),
  };
}
