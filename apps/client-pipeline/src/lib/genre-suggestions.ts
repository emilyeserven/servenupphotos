import type { GenreSuggestions, GenreSuggestionsPreview } from "@/api/genre-suggestions";
import type { BulkTagPhotoPlan } from "@/api/bulk-tags";

/** What the review of a Genre Suggestions answer changes; everything else is saved as suggested. */
export interface GenreChoices {
  /** The IDs of new genres not to make, which aren't added to any photo either. */
  dropped: ReadonlySet<string>;
  /**
   * The genre picked in each of a photo's dropdowns that was changed, by `genreSlotKey`, or "" for
   * no genre. A dropdown that isn't in here keeps the suggested genre.
   */
  chosen: ReadonlyMap<string, string>;
}

/** Nothing changed, which a review starts with. */
export const NO_GENRE_CHOICES: GenreChoices = { dropped: new Set(), chosen: new Map() };

/**
 * The genre each of a photo's dropdowns starts with: one per suggested genre, or a single one with
 * no genre ("") when the answer suggested none, so a genre can still be picked for it.
 */
export function genreSlots(plan: BulkTagPhotoPlan): string[] {
  return plan.add.length > 0 ? plan.add : [""];
}

/** The key of a photo's dropdown in `GenreChoices.chosen`: its path and its place among them. */
function genreSlotKey(path: string, slot: number): string {
  return `${path}\n${slot}`;
}

/**
 * The genre a photo's dropdown shows: the one picked there, or else the suggested one, and no
 * genre ("") when that's a new genre that won't be made.
 */
export function chosenGenre(
  choices: GenreChoices,
  path: string,
  slot: number,
  suggested: string,
): string {
  const id = choices.chosen.get(genreSlotKey(path, slot)) ?? suggested;
  return choices.dropped.has(id) ? "" : id;
}

/** The choices with one of a photo's dropdowns set to `id` ("" for no genre). */
export function withChosenGenre(
  choices: GenreChoices,
  path: string,
  slot: number,
  id: string,
): GenreChoices {
  const chosen = new Map(choices.chosen);
  chosen.set(genreSlotKey(path, slot), id);
  return { ...choices, chosen };
}

/** The genres a photo gets once reviewed: what its dropdowns show, each once, leaving out no genre. */
function photoGenres(choices: GenreChoices, plan: BulkTagPhotoPlan): string[] {
  const ids = genreSlots(plan).map((suggested, slot) =>
    chosenGenre(choices, plan.path, slot, suggested),
  );
  return [...new Set(ids.filter((id) => id !== ""))];
}

/** What to save from a reviewed answer: the ticked new genres and the genres picked for each photo. */
export function genresToSave(
  preview: GenreSuggestionsPreview,
  choices: GenreChoices,
): GenreSuggestions {
  return {
    newGenres: preview.newGenres
      .filter((genre) => !choices.dropped.has(genre.id))
      .map(({ id, name, description }) => ({ id, name, description })),
    photos: preview.photos
      .map((photo) => ({ path: photo.path, genres: photoGenres(choices, photo) }))
      .filter((photo) => photo.genres.length > 0),
  };
}
