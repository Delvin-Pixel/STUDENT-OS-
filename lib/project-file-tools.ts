import { jsonSchema, tool, type ToolSet } from 'ai';
import { getProjectFile, listProjectFiles } from '@/lib/project-files';

const listSchema = {
  type: 'object',
  properties: {
    limit: { type: 'number', minimum: 1, maximum: 50 },
  },
  additionalProperties: false,
} as const;

const readSchema = {
  type: 'object',
  properties: {
    fileId: { type: 'string', description: 'Project file ID returned by list_project_files or search_project.' },
  },
  required: ['fileId'],
  additionalProperties: false,
} as const;

export function createProjectFileTools(user: { id: string }, projectId?: string | null): ToolSet {
  if (!projectId) return {};
  return {
    list_project_files: tool({
      title: 'List project files',
      description: 'List persistent knowledge files attached to the active project.',
      inputSchema: jsonSchema<Record<string, unknown>>(listSchema),
      execute: async (input) => {
        const value = input as Record<string, unknown>;
        const files = await listProjectFiles(user.id, projectId, Number(value.limit ?? 20));
        return {
          files: files.map((file) => ({
            id: file.id,
            filename: file.filename,
            mediaType: file.media_type,
            sizeBytes: file.size_bytes,
            sha256: file.sha256,
            version: file.version,
            sourceKind: file.source_kind,
            sourceMediaType: file.source_media_type,
            sourceSizeBytes: file.source_size_bytes,
            extractionStatus: file.extraction_status,
            updatedAt: file.updated_at,
          })),
        };
      },
    }),
    read_project_file: tool({
      title: 'Read project file',
      description: 'Read the exact contents of a persistent knowledge file in the active project before answering questions that depend on it.',
      inputSchema: jsonSchema<Record<string, unknown>>(readSchema),
      execute: async (input) => {
        const value = input as Record<string, unknown>;
        const file = await getProjectFile(user.id, projectId, String(value.fileId ?? ''));
        if (!file) return { error: 'Project file not found.' };
        return {
          file: {
            id: file.id,
            filename: file.filename,
            mediaType: file.media_type,
            content: file.content,
            sha256: file.sha256,
            version: file.version,
            sourceKind: file.source_kind,
            extractionStatus: file.extraction_status,
          },
        };
      },
    }),
  };
}
