import { mutationOptions } from "@tanstack/react-query";
import { type BulkTagPhoto, groupAndPhotoChanges, postJson } from "@/api/bulk-tags";
import type { PendingSave } from "@/api/scan-changes";

/** Up to the chosen number of related photos without an album: one, then the ones most like it. */
export interface AlbumPick {
  branch: string;
  pullRequest: { number: number; url: string } | null;
  /** How many photo files there are. */
  photoFiles: number;
  /** How many photo files aren't in an album. */
  withoutAlbum: number;
  photos: BulkTagPhoto[];
}

/** One album the pasted answer puts picked photos in, existing or new. */
export interface AlbumSuggestion {
  /** The album's ID; "" when the answer's name can't be an album. */
  id: string;
  name: string;
  /** The answer's description of a new album. */
  description: string;
  /** The ID of the existing album a new one goes inside, or "" for none. */
  parent: string;
  /** True for an album that isn't one yet. */
  new: boolean;
  /** The paths of the picked photos to put in it. */
  photos: string[];
  /** Why it can't be an album; "" when it can. */
  reason: string;
}

/** What pasting the answer would do: the albums, existing and new, and the photos each gets. */
export interface AlbumSuggestionsPreview {
  albums: AlbumSuggestion[];
  /** Photos the answer names that aren't any of the picked ones. */
  unknown: string[];
}

/** What Album Suggestions saves once reviewed: the new albums to make and each photo's albums. */
export interface AlbumSuggestions {
  newAlbums: { id: string; name: string; description: string; parent?: string }[];
  photos: { path: string; albums: string[] }[];
}

interface AlbumSuggestionsResult extends PendingSave {
  /** How many albums were made. */
  newAlbums: number;
  /** How many photo files were put in albums. */
  photos: number;
}

/** Picks up to `count` related photos without an album (1 to 50), leaving out the ones already shown. */
export const pickAlbumPhotosMutation = mutationOptions({
  mutationKey: ["data", "album-suggestions", "pick"],
  mutationFn: (body: { skip: string[]; count: number }) =>
    postJson<AlbumPick>("/api/data/album-suggestions/pick", body),
});

/** Reads the LLM's pasted answer for the picked photos and says which albums they'd go in, saving nothing. */
export const previewAlbumSuggestionsMutation = mutationOptions({
  mutationKey: ["data", "album-suggestions", "preview"],
  mutationFn: (body: { paths: string[]; answer: string }) =>
    postJson<AlbumSuggestionsPreview>("/api/data/album-suggestions/preview", body),
});

/** Makes the new albums and puts each photo in its albums, as changes waiting for Commit. */
export const applyAlbumSuggestionsMutation = mutationOptions({
  mutationKey: ["data", "album-suggestions", "apply"],
  meta: {
    saves: true,
    changes: (result) => groupAndPhotoChanges(result as PendingSave, "albums"),
  },
  mutationFn: (save: AlbumSuggestions) =>
    postJson<AlbumSuggestionsResult>("/api/data/album-suggestions", save),
});
