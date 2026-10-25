import { type Group, subTags, tagAndSubTags, tags } from "@/lib/groups";
import { photos, type Photo } from "@/lib/photos";
import { type ImagePhoto, newestWithImages } from "@/lib/spotlight-zones";

/** One tag on the Tags page: its photos, counting the tags under it, and a few to preview. */
export interface TagEntry {
  tag: Group;
  /** The tags between the section's parent tag and this one, for a tag more than one level down. */
  between: Group[];
  /** How many photos have the tag or a tag under it. */
  count: number;
  /** Its newest few photos with images, for the card's thumbnails. */
  previews: ImagePhoto[];
}

/** A parent tag on the Tags page with every tag under it, however deep. */
export interface TagSection {
  parent: TagEntry;
  children: TagEntry[];
}

/** How many photos a tag's card previews. */
const PREVIEW_COUNT = 3;

/** The tag with its photo count and previews, from the photos given. */
function entryOf(tag: Group, between: Group[], all: Photo[]): TagEntry {
  const ids = tagAndSubTags(tag.id);
  const tagged = all.filter((photo) => photo.tags.some((id) => ids.has(id)));
  return {
    tag,
    between,
    count: tagged.length,
    previews: newestWithImages(tagged).slice(0, PREVIEW_COUNT),
  };
}

/** By name. */
function byName(a: Group, b: Group): number {
  return a.name.localeCompare(b.name);
}

/** The tags without a parent tag, by name, counting ones whose parent isn't a tag. */
function topTags(): Group[] {
  const known = new Set(tags.map((tag) => tag.id));
  return tags
    .filter((tag) => !known.has(tag.parent ?? "") || tag.parent === tag.id)
    .toSorted(byName);
}

/**
 * Every tag under the tag, however deep, by name with each one's own tags right after it, and the
 * tags between. A tag in a loop of parents is left out.
 */
function descendants(parent: Group, between: Group[], seen: Set<string>, all: Photo[]): TagEntry[] {
  const fresh = subTags(parent.id)
    .filter((tag) => !seen.has(tag.id))
    .toSorted(byName);
  for (const tag of fresh) seen.add(tag.id);
  return fresh.flatMap((tag) => [
    entryOf(tag, between, all),
    ...descendants(tag, [...between, tag], seen, all),
  ]);
}

/** Leaves out the tags without photos. */
function withPhotos(entries: TagEntry[]): TagEntry[] {
  return entries.filter((entry) => entry.count > 0);
}

/**
 * Every top-level tag with photos, by name, each with the tags under it that have photos. A tag
 * with none under it has no children.
 */
export function tagSections(all: Photo[] = photos): TagSection[] {
  return topTags()
    .map((tag) => ({
      parent: entryOf(tag, [], all),
      children: withPhotos(descendants(tag, [], new Set([tag.id]), all)),
    }))
    .filter((section) => section.parent.count > 0);
}
