import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { bulkTagChanges } from "@/api/bulk-tags";
import type { PendingSave } from "@/api/scan-changes";
import { post } from "@/api/data";
import type { PruneTags, PruneTagsPreview } from "@/api/prune-tags";

/** One tag as the Tag library exports it. */
export interface TagLibraryTag {
  tag: string;
  description: string;
  /** The tag it's under, or "" at the top level. */
  parent: string;
  /** How many photo files list it. */
  photos: number;
}

/** One photo as the Tag library exports it: what's known of it that helps pick its tags. */
export interface TagLibraryPhotoInfo {
  /** Its file name without .json. */
  photo: string;
  title: string;
  city: string;
  country: string;
  places: string[];
  genres: string[];
  albums: string[];
  tags: string[];
  /** The photographer-only notes, "" when it has none. */
  notes: string;
}

/** Every tag and every readable photo with its tags, as the next Commit will have them. */
export interface TagLibraryExport {
  tags: TagLibraryTag[];
  photos: TagLibraryPhotoInfo[];
  /** The photo files that couldn't be read, which the export leaves out. */
  unreadable: string[];
  /** The fewest photos a tag should have. */
  minPhotos: number;
}

/** A tag the answer makes. */
export interface TagLibraryNewTag {
  tag: string;
  description: string;
  /** The tag it goes under, or "" for the top level. */
  parent: string;
  reason: string;
}

/** A tag the answer gives a new ID, keeping its photos, description and the tags under it. */
export interface TagLibraryRename {
  tag: string;
  to: string;
  reason: string;
  /** How many photo files list it. */
  photos: number;
}

/** A new description the answer gives a tag. */
export interface TagLibraryDescribe {
  tag: string;
  /** Its description now, "" when it has none. */
  from: string;
  description: string;
}

/** The tags the answer adds to and takes off one photo. */
export interface TagLibraryPhotoEdit {
  photo: string;
  path: string;
  add: string[];
  remove: string[];
  reason: string;
  /** The photo's tags before this change. */
  tags: string[];
}

/** A note the answer adds to one photo's photographer-only notes. */
export interface TagLibraryNote {
  photo: string;
  path: string;
  note: string;
}

/** What pasting the answer would do to the whole tag library, and what can't be made. */
export interface TagLibraryPreview extends Omit<PruneTagsPreview, "tags"> {
  /** How many tags and readable photo files there are. */
  tags: number;
  photos: number;
  newTags: TagLibraryNewTag[];
  rename: TagLibraryRename[];
  describe: TagLibraryDescribe[];
  edits: TagLibraryPhotoEdit[];
  notes: TagLibraryNote[];
  /** Every tag left with fewer than `minPhotos` photos after the changes. */
  fewPhotos: { tag: string; photos: number; parent: string }[];
  minPhotos: number;
}

/** What the Tag library saves once reviewed. */
export interface TagLibrary extends PruneTags {
  newTags: { id: string; description: string; parent: string }[];
  rename: { tag: string; to: string }[];
  describe: { tag: string; description: string }[];
  photos: { path: string; add: string[]; remove: string[] }[];
  notes: { path: string; note: string }[];
}

interface TagLibraryResult extends PendingSave {
  /** How many tag files were made, and deleted (merged, renamed or removed). */
  made: number;
  deleted: number;
  /** How many kept tags got a new parent or description. */
  edited: number;
  /** How many photo files had their tags or notes changed. */
  photos: number;
}

/** Every tag and photo with its tags, read from GitHub with the changes waiting for Commit. */
export const tagLibraryQuery = queryOptions({
  queryKey: ["data", "tag-library", "export"],
  queryFn: () => post<TagLibraryExport>("/api/data/tag-library/export", {}),
  retry: false,
});

/** Reads the LLM's pasted answer and says what each suggested change would do, saving nothing. */
export const previewTagLibraryMutation = mutationOptions({
  mutationKey: ["data", "tag-library", "preview"],
  mutationFn: (body: { answer: string }) =>
    post<TagLibraryPreview>("/api/data/tag-library/preview", body),
});

/** Makes the reviewed changes to the tags and photos, as changes waiting for Commit. */
export const applyTagLibraryMutation = mutationOptions({
  mutationKey: ["data", "tag-library", "apply"],
  meta: { saves: true, changes: (result) => bulkTagChanges(result as TagLibraryResult) },
  mutationFn: (library: TagLibrary) => post<TagLibraryResult>("/api/data/tag-library", library),
});
