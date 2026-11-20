import { mutationOptions } from "@tanstack/react-query";
import { post } from "@/api/request";
import type { BulkTagPhoto, BulkTagPhotoPlan } from "@/api/bulk-tags";
import type { PendingSave } from "@/api/scan-changes";

/**
 * Up to the chosen number of photos without genres (or, to reassign, with genres), in file name
 * order, to suggest genres for together.
 */
export interface GenrePick {
  branch: string;
  pullRequest: { number: number; url: string } | null;
  /** How many photo files there are. */
  photoFiles: number;
  /** How many photo files have no genres. */
  withoutGenres: number;
  /** How many photo files the pick picks from: without genres, or with them to reassign. */
  matching: number;
  /** The photos, as Bulk Tagging picks them, with nothing in `related`. */
  photos: BulkTagPhoto[];
}

/** A genre the answer names that isn't one yet. */
export interface GenreNew {
  id: string;
  /** The name as the answer first wrote it, such as "Night". */
  name: string;
  /** The answer's description of it; empty when it gave none. */
  description: string;
  /**
   * The ID of the genre the answer makes it a subgenre of, a genre there is or another new one, or
   * "" for a top-level genre.
   */
  parent: string;
}

/** Which photos Genre Suggestions picks, besides the ones already shown and how many. */
export interface GenrePickWhich {
  /** True to pick photos that already have genres, whose genres the answer replaces. */
  reassign: boolean;
  /** With `reassign`, only photos in this genre or one of its subgenres, by ID; "" for any genre. */
  genre: string;
}

/** What pasting the answer would do: the genres each photo gets and the new genres to make. */
export interface GenreSuggestionsPreview {
  /**
   * Each picked photo, with the genre IDs to add in `add`; when reassigning, every genre the answer
   * gives it, which replace its genres.
   */
  photos: BulkTagPhotoPlan[];
  newGenres: GenreNew[];
  /** Photos the answer names that aren't any photo, which are skipped. */
  unknown: string[];
  /** Photos the answer names that weren't picked, found among every photo; the review shows them too. */
  others: BulkTagPhoto[];
}

/**
 * What Genre Suggestions saves once reviewed: the new genres to make, each under its parent genre
 * when it's a subgenre, and the genres to add to each photo.
 */
export interface GenreSuggestions {
  newGenres: { id: string; name: string; description: string; parent?: string }[];
  photos: { path: string; genres: string[] }[];
  /** True when each photo's genres become the ones listed, instead of having them added. */
  reassign: boolean;
}

interface GenreSuggestionsResult extends PendingSave {
  /** How many genres were made. */
  newGenres: number;
  /** How many photo files got genres. */
  photos: number;
}

/**
 * Picks up to `count` photos without genres (1 to 50), or with genres to reassign, leaving out the
 * ones already shown.
 */
export const pickGenrePhotosMutation = mutationOptions({
  mutationKey: ["data", "genre-suggestions", "pick"],
  mutationFn: (body: { skip: string[]; count: number } & GenrePickWhich) =>
    post<GenrePick>("/api/data/genre-suggestions/pick", body),
});

/** Reads the LLM's pasted answer for the picked photos and says what it would add, saving nothing. */
export const previewGenreSuggestionsMutation = mutationOptions({
  mutationKey: ["data", "genre-suggestions", "preview"],
  mutationFn: (body: { paths: string[]; answer: string; reassign: boolean }) =>
    post<GenreSuggestionsPreview>("/api/data/genre-suggestions/preview", body),
});

/** The genre and photo files a Genre Suggestions save changed, as changes over the combined lists. */
function genreChanges(result: GenreSuggestionsResult) {
  return result.changes.map((change) => ({
    kind: change.path.includes("/genres/") ? ("genres" as const) : ("photos" as const),
    ...change,
  }));
}

/**
 * Makes the new genres and adds the genres to each photo (or, reassigning, makes them its genres),
 * as changes waiting for Commit.
 */
export const applyGenreSuggestionsMutation = mutationOptions({
  mutationKey: ["data", "genre-suggestions", "apply"],
  meta: { saves: true, changes: (result) => genreChanges(result as GenreSuggestionsResult) },
  mutationFn: (body: GenreSuggestions) =>
    post<GenreSuggestionsResult>("/api/data/genre-suggestions", body),
});
