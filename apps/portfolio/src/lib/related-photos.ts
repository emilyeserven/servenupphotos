/** A photo shown in another's More like this drawer, with the note picked for it. */
export interface RelatedPhoto {
  id: number;
  /** Shown to the right of it in the drawer; null for the ones found automatically and picks without one. */
  note: string | null;
}

/** The photo JSON fields More like this reads, as the pipeline's Related Photos page saves them. */
interface RelatedFields {
  pickedSimilar?: number[];
  pickedSimilarNotes?: Record<string, string>;
  similarPhotos?: number[];
}

/**
 * The photos a photo's More like this drawer shows, in order: the ones picked by hand, with their
 * notes, then the ones the pipeline found that aren't picked.
 */
export function relatedPhotos({
  pickedSimilar = [],
  pickedSimilarNotes = {},
  similarPhotos = [],
}: RelatedFields): RelatedPhoto[] {
  const picked = new Set(pickedSimilar);
  return [
    ...pickedSimilar.map((id) => ({ id, note: pickedSimilarNotes[String(id)]?.trim() || null })),
    ...similarPhotos.filter((id) => !picked.has(id)).map((id) => ({ id, note: null })),
  ];
}
