import type { BulkTagPhotoPlan } from "@/api/bulk-tags";
import type { GenreNew, GenreSuggestions, GenreSuggestionsPreview } from "@/api/genre-suggestions";

/** What the review of a Genre Suggestions answer changes; everything else is saved as suggested. */
export interface GenreChoices {
  /** The IDs of new genres not to make, which aren't added to any photo either. */
  dropped: ReadonlySet<string>;
  /**
   * The genre picked in each of a photo's dropdowns that was changed, by `genreSlotKey`, or "" for
   * no genre. A dropdown that isn't in here keeps the suggested genre.
   */
  chosen: ReadonlyMap<string, string>;
  /**
   * The parent picked for a new genre that was changed, by its ID, or "" for top level. A new genre
   * that isn't in here keeps the parent the answer gave it.
   */
  parents: ReadonlyMap<string, string>;
}

/** Nothing changed, which a review starts with. */
export const NO_GENRE_CHOICES: GenreChoices = {
  dropped: new Set(),
  chosen: new Map(),
  parents: new Map(),
};

/**
 * The parent a new genre gets: the one picked for it, or else the answer's, and none when that's a
 * new genre that won't be made.
 */
export function chosenParent(choices: GenreChoices, genre: GenreNew): string {
  const parent = choices.parents.get(genre.id) ?? genre.parent;
  return choices.dropped.has(parent) ? "" : parent;
}

/** The choices with the new genre `id` put under `parent` ("" for top level). */
export function withChosenParent(choices: GenreChoices, id: string, parent: string): GenreChoices {
  const parents = new Map(choices.parents);
  parents.set(id, parent);
  return { ...choices, parents };
}

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

/** A new genre as it's saved, with its parent only when it's a subgenre. */
function newGenreToSave(
  choices: GenreChoices,
  genre: GenreNew,
): GenreSuggestions["newGenres"][number] {
  const { id, name, description } = genre;
  const parent = chosenParent(choices, genre);
  return parent ? { id, name, description, parent } : { id, name, description };
}

/**
 * What to save from a reviewed answer: the ticked new genres, each under the parent picked for it,
 * and the genres picked for each photo, which replace its genres when `reassign` is true.
 */
export function genresToSave(
  preview: GenreSuggestionsPreview,
  choices: GenreChoices,
  reassign = false,
): GenreSuggestions {
  return {
    reassign,
    newGenres: preview.newGenres
      .filter((genre) => !choices.dropped.has(genre.id))
      .map((genre) => newGenreToSave(choices, genre)),
    photos: preview.photos
      .map((photo) => ({ path: photo.path, genres: photoGenres(choices, photo) }))
      .filter((photo) => photo.genres.length > 0),
  };
}
