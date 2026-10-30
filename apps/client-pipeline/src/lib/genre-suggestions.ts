import type { GenreSuggestions, GenreSuggestionsPreview } from "@/api/genre-suggestions";
import { photoTagKey } from "@/lib/bulk-tags";

/** What the review of a Genre Suggestions answer leaves out; everything else is saved. */
export interface GenreChoices {
  /** The IDs of new genres not to make, which aren't added to any photo either. */
  dropped: ReadonlySet<string>;
  /** The genres not to add to a photo, each as photoTagKey makes it. */
  removed: ReadonlySet<string>;
}

/** Nothing left out, which a review starts with. */
export const NO_GENRE_CHOICES: GenreChoices = { dropped: new Set(), removed: new Set() };

/** What to save from a reviewed answer: the ticked new genres and the ticked genres for each photo. */
export function genresToSave(
  preview: GenreSuggestionsPreview,
  choices: GenreChoices,
): GenreSuggestions {
  const kept = (path: string, id: string) =>
    !choices.dropped.has(id) && !choices.removed.has(photoTagKey(path, id));
  return {
    newGenres: preview.newGenres
      .filter((genre) => !choices.dropped.has(genre.id))
      .map(({ id, name, description }) => ({ id, name, description })),
    photos: preview.photos
      .map((photo) => ({
        path: photo.path,
        genres: photo.add.filter((id) => kept(photo.path, id)),
      }))
      .filter((photo) => photo.genres.length > 0),
  };
}
