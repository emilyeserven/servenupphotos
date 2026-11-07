import { mutationOptions } from "@tanstack/react-query";
import { post } from "@/api/data";
import type { BulkTagPhoto } from "@/api/bulk-tags";
import { type PendingSave, photoChanges } from "@/api/scan-changes";

/** Up to the chosen number of photos without alt text, in file name order, to ask an LLM about together. */
export interface AltTextPick {
  branch: string;
  pullRequest: { number: number; url: string } | null;
  /** How many photo files there are. */
  photoFiles: number;
  /** How many photo files have no alt text. */
  withoutAltText: number;
  /** The photos, as Bulk Tagging picks them, with nothing in `related`. */
  photos: BulkTagPhoto[];
}

/** The alt text the answer gives one picked photo. */
export interface AltTextSuggestion {
  path: string;
  /** The file's name without `.json`, as the prompt calls it. */
  name: string;
  /** The answer's alt text for it; empty when the answer has none. */
  altText: string;
  /** The alt text the photo has already; empty when it has none. */
  current: string;
}

/** What pasting the answer would do: the alt text each picked photo gets. */
export interface AltTextPreview {
  photos: AltTextSuggestion[];
  /** Photos the answer names that aren't any of the picked ones. */
  unknown: string[];
}

/** What the Alt Text page saves once reviewed: the alt text for each photo. */
interface AltTexts {
  photos: { path: string; altText: string }[];
}

interface AltTextResult extends PendingSave {
  /** How many photo files got new alt text. */
  photos: number;
}

/** Picks up to `count` photos without alt text (1 to 50), leaving out the ones already shown. */
export const pickAltTextPhotosMutation = mutationOptions({
  mutationKey: ["data", "alt-text", "pick"],
  mutationFn: (body: { skip: string[]; count: number }) =>
    post<AltTextPick>("/api/data/alt-text/pick", body),
});

/** Reads the LLM's pasted answer for the picked photos and says the alt text each gets, saving nothing. */
export const previewAltTextMutation = mutationOptions({
  mutationKey: ["data", "alt-text", "preview"],
  mutationFn: (body: { paths: string[]; answer: string }) =>
    post<AltTextPreview>("/api/data/alt-text/preview", body),
});

/** Writes the reviewed alt text into each photo's file, as changes waiting for Commit. */
export const applyAltTextMutation = mutationOptions({
  mutationKey: ["data", "alt-text", "apply"],
  meta: { saves: true, changes: (result) => photoChanges(result as AltTextResult) },
  mutationFn: (body: AltTexts) => post<AltTextResult>("/api/data/alt-text", body),
});
