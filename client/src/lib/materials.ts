import type { StudyMaterial } from "./types";

/** A stored private object may be returned by a server-side content dedupe; keep one canonical workspace record per storage key. */
export function hasStudyMaterialStorageKey(
  materials: StudyMaterial[],
  storageKey: string
) {
  return materials.some(material => material.storageKey === storageKey);
}

export function removeStudyMaterialById(
  materials: StudyMaterial[],
  id: string
) {
  return materials.filter(material => material.id !== id);
}
