import type { BulkTagPhoto } from "@/api/bulk-tags";

/**
 * The pick with the photos a pasted answer names that weren't picked added after the picked ones,
 * each once, so the review can show their titles and images too.
 */
export function withOthers<T extends { photos: BulkTagPhoto[] }>(
  pick: T,
  others: BulkTagPhoto[] | undefined,
): T {
  const picked = new Set(pick.photos.map((photo) => photo.path));
  const added = (others ?? []).filter((photo) => !picked.has(photo.path));
  return added.length > 0 ? { ...pick, photos: [...pick.photos, ...added] } : pick;
}
