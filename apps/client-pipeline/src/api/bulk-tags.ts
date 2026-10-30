import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { PendingSave } from "@/api/scan-changes";
import { requestJson } from "@/api/settings";

/** One photo Bulk Tagging picked to tag with the others. */
export interface BulkTagPhoto {
  path: string;
  fileUrl?: string;
  /** The file's name without `.json`, which the prompt and the pasted answer call the photo by. */
  name: string;
  /** The photo's JSON, for its image and what's known of where it was taken. */
  data: Record<string, unknown>;
  /** What it shares with the first photo, such as "same city: kyoto"; empty for the first. */
  related: string[];
}

/** Up to the chosen number of related photos without tags to tag together: one, then the ones most like it. */
export interface BulkTagPick {
  branch: string;
  pullRequest: { number: number; url: string } | null;
  /** How many photo files there are. */
  photoFiles: number;
  /** How many photo files have no tags. */
  untagged: number;
  photos: BulkTagPhoto[];
}

/** A name in the answer that can't be a tag, with why. */
export interface BulkTagSkipped {
  name: string;
  reason: string;
}

/** What the pasted answer adds to one photo. */
export interface BulkTagPhotoPlan {
  path: string;
  name: string;
  /** The IDs of the tags to add, existing and new. */
  add: string[];
  /** The IDs of the tags the answer names that it already has. */
  already: string[];
  skipped: BulkTagSkipped[];
}

/** A tag the answer names that isn't one yet. */
export interface BulkTagNew {
  id: string;
  /** The answer's definition of it; empty when it gave none. */
  description: string;
  /** The more general tag it goes under, or "" for none. */
  parent: string;
  /** True for a tag made only to be another new tag's parent. */
  parentOnly: boolean;
}

/** What pasting the answer would do: the tags each photo gets and the new tags to make. */
export interface BulkTagsPreview {
  photos: BulkTagPhotoPlan[];
  newTags: BulkTagNew[];
  /** Photos the answer names that aren't any of the picked ones. */
  unknown: string[];
}

/** What Bulk Tagging saves once reviewed: the new tags to make and the tags to add to each photo. */
export interface BulkTags {
  newTags: { id: string; name: string; description: string; parent?: string }[];
  photos: { path: string; tags: string[] }[];
}

interface BulkTagsResult extends PendingSave {
  /** How many tags were made. */
  newTags: number;
  /** How many photo files got tags. */
  photos: number;
}

function post<T>(url: string, body: unknown) {
  return requestJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** What a Bulk Tagging pick asks for. */
interface BulkTagPickOptions {
  /** The photos already shown, to leave out. */
  skip: string[];
  /** How many photos to pick, 1 to 50. */
  count: number;
  /** True picks the first photos without tags by file name, whether or not they go together. */
  any: boolean;
}

/** How many photo files there are and how many have no tags, with no photos picked. */
export const untaggedPhotosQuery = queryOptions({
  queryKey: ["data", "bulk-tags", "untagged"],
  queryFn: () => post<BulkTagPick>("/api/data/bulk-tags/untagged", {}),
  retry: false,
});

/** Picks up to `count` photos (1 to 50) to tag together, leaving out the ones already shown. */
export const pickBulkTagPhotosMutation = mutationOptions({
  mutationKey: ["data", "bulk-tags", "pick"],
  mutationFn: (body: BulkTagPickOptions) => post<BulkTagPick>("/api/data/bulk-tags/pick", body),
});

/** Reads the LLM's pasted answer for the picked photos and says what it would add, saving nothing. */
export const previewBulkTagsMutation = mutationOptions({
  mutationKey: ["data", "bulk-tags", "preview"],
  mutationFn: (body: { paths: string[]; answer: string }) =>
    post<BulkTagsPreview>("/api/data/bulk-tags/preview", body),
});

/** The tag and photo files a Bulk Tagging save changed, as changes over the combined lists. */
function bulkTagChanges(result: BulkTagsResult) {
  return result.changes.map((change) => ({
    kind: change.path.includes("/tags/") ? ("tags" as const) : ("photos" as const),
    ...change,
  }));
}

/** Makes the new tags and adds the tags to each photo, as changes waiting for Commit. */
export const applyBulkTagsMutation = mutationOptions({
  mutationKey: ["data", "bulk-tags", "apply"],
  meta: { saves: true, changes: (result) => bulkTagChanges(result as BulkTagsResult) },
  mutationFn: (bulk: BulkTags) => post<BulkTagsResult>("/api/data/bulk-tags", bulk),
});
