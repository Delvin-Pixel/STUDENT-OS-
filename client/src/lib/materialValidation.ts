import type { StudyMaterial } from "./types";

export type NewStudyMaterial = Omit<StudyMaterial, "id" | "addedAt">;

const MATERIAL_MIME_TYPES: readonly StudyMaterial["mimeType"][] = [
  "application/pdf",
  "text/plain",
];

/** Produces the canonical text form for a completed server-owned material upload. */
export function normalizeNewStudyMaterial(
  material: NewStudyMaterial
): NewStudyMaterial {
  return {
    ...material,
    title: material.title.trim(),
    subject: material.subject.trim(),
    fileName: material.fileName.trim(),
    storageKey: material.storageKey.trim(),
    url: material.url.trim(),
  };
}

/** Mirrors canonical workspace material bounds before recording a completed upload locally. */
export function validateNewStudyMaterial(
  material: NewStudyMaterial
): string | null {
  if (!material.title.trim() || material.title.trim().length > 1_000)
    return "Give the material a title of up to 1,000 characters.";
  if (!material.subject.trim() || material.subject.trim().length > 1_000)
    return "Choose a subject of up to 1,000 characters.";
  if (!material.fileName.trim() || material.fileName.trim().length > 1_000)
    return "Give the uploaded file a name of up to 1,000 characters.";
  if (!MATERIAL_MIME_TYPES.includes(material.mimeType))
    return "Choose a PDF or plain-text study material.";
  if (!material.storageKey.trim() || material.storageKey.trim().length > 1_024)
    return "The uploaded file reference is not valid.";
  if (material.url.trim().length > 2_048)
    return "The uploaded file link is not valid.";
  if (
    !Number.isInteger(material.sizeBytes) ||
    material.sizeBytes < 1 ||
    material.sizeBytes > 3_000_000
  )
    return "Study materials must be between 1 byte and 3 MB.";
  return null;
}
