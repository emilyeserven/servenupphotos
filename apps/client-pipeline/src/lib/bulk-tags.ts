import type { BulkTagNew, BulkTags, BulkTagsPreview } from "@/api/bulk-tags";

/** What the review of a Bulk Tagging answer leaves out; everything else is saved. */
export interface BulkTagChoices {
  /** The IDs of new tags not to make, which aren't added to any photo either. */
  dropped: ReadonlySet<string>;
  /** The IDs of new tags not to put under the parent the answer suggests. */
  noParent: ReadonlySet<string>;
  /** The tags not to add to a photo, each as photoTagKey makes it. */
  removed: ReadonlySet<string>;
}

/** Nothing left out, which a review starts with. */
export const NO_CHOICES: BulkTagChoices = {
  dropped: new Set(),
  noParent: new Set(),
  removed: new Set(),
};

/** The key of one tag on one photo, for BulkTagChoices.removed. */
export function photoTagKey(path: string, id: string): string {
  return `${path}\n${id}`;
}

/** `set` with `item` added when it's missing, or taken out when it's there. */
export function toggled(set: ReadonlySet<string>, item: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(item)) next.add(item);
  return next;
}

/** Whether the new tag `id` is made: it's not one of the new tags, or it is and is still ticked. */
function isKept(preview: BulkTagsPreview, choices: BulkTagChoices, id: string): boolean {
  return !choices.dropped.has(id) || !preview.newTags.some((tag) => tag.id === id);
}

/** The parent a new tag is saved under, or undefined when it's left at the top level. */
function savedParent(tag: BulkTagNew, choices: BulkTagChoices, preview: BulkTagsPreview) {
  const keep = tag.parent !== "" && !choices.noParent.has(tag.id);
  return keep && isKept(preview, choices, tag.parent) ? tag.parent : undefined;
}

/** The new tags that are ticked, each with its parent when it keeps it. */
function chosenChildren(preview: BulkTagsPreview, choices: BulkTagChoices) {
  return preview.newTags
    .filter((tag) => !tag.parentOnly && !choices.dropped.has(tag.id))
    .map((tag) => ({
      id: tag.id,
      name: tag.id,
      description: tag.description,
      parent: savedParent(tag, choices, preview),
    }));
}

/** The tags to add to each photo, leaving out the ones unticked and photos left with none. */
function chosenPhotos(preview: BulkTagsPreview, choices: BulkTagChoices) {
  return preview.photos
    .map((photo) => ({
      path: photo.path,
      tags: photo.add.filter(
        (id) => !choices.removed.has(photoTagKey(photo.path, id)) && isKept(preview, choices, id),
      ),
    }))
    .filter((photo) => photo.tags.length > 0);
}

/**
 * What to save from a reviewed answer: the ticked new tags, after the parents made only for them
 * that are still needed, and the ticked tags for each photo.
 */
export function bulkTagsToSave(preview: BulkTagsPreview, choices: BulkTagChoices): BulkTags {
  const children = chosenChildren(preview, choices);
  const parents = preview.newTags
    .filter((tag) => tag.parentOnly && children.some((child) => child.parent === tag.id))
    .map((tag) => ({ id: tag.id, name: tag.id, description: "" }));
  return { newTags: [...parents, ...children], photos: chosenPhotos(preview, choices) };
}
