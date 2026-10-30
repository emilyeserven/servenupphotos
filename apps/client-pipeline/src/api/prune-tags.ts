import { mutationOptions } from "@tanstack/react-query";
import { bulkTagChanges } from "@/api/bulk-tags";
import type { PendingSave } from "@/api/scan-changes";
import { postJson as post } from "@/api/settings";

/** A merge the answer suggests: every photo with `tag` gets `into` instead. */
export interface PruneTagMerge {
  tag: string;
  into: string;
  reason: string;
  /** How many photo files list `tag`. */
  photos: number;
  /** The tags directly under `tag`, which go under `into`. */
  children: string[];
}

/** A tag the answer suggests removing, from every photo too. */
export interface PruneTagRemoval {
  tag: string;
  reason: string;
  /** How many photo files list it. */
  photos: number;
  /** The tags directly under it, which go under its parent. */
  children: string[];
}

/** A new parent the answer suggests for a tag. */
export interface PruneTagReparent {
  tag: string;
  /** Its parent now, or "" at the top level. */
  from: string;
  /** Its new parent, or "" for the top level. */
  parent: string;
  reason: string;
}

/** What pasting the answer would do to the tags, and the changes in it that can't be made. */
export interface PruneTagsPreview {
  /** How many tags there are. */
  tags: number;
  merge: PruneTagMerge[];
  remove: PruneTagRemoval[];
  reparent: PruneTagReparent[];
  skipped: { change: string; reason: string }[];
}

/** What Tag pruning saves once reviewed. */
export interface PruneTags {
  merge: { tag: string; into: string }[];
  remove: string[];
  reparent: { tag: string; parent: string }[];
}

interface PruneTagsResult extends PendingSave {
  /** How many tag files were deleted, merged or removed. */
  deleted: number;
  /** How many tags got a new parent, asked for or because theirs was deleted. */
  reparented: number;
  /** How many photo files had their tags changed. */
  photos: number;
}

/** Reads the LLM's pasted answer and says what each suggested change would do, saving nothing. */
export const previewPruneTagsMutation = mutationOptions({
  mutationKey: ["data", "prune-tags", "preview"],
  mutationFn: (body: { answer: string }) =>
    post<PruneTagsPreview>("/api/data/prune-tags/preview", body),
});

/** Merges, removes and reparents the reviewed tags, as changes waiting for Commit. */
export const applyPruneTagsMutation = mutationOptions({
  mutationKey: ["data", "prune-tags", "apply"],
  meta: { saves: true, changes: (result) => bulkTagChanges(result as PruneTagsResult) },
  mutationFn: (prune: PruneTags) => post<PruneTagsResult>("/api/data/prune-tags", prune),
});
