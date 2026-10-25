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
  /** The newest few photos tagged with the parent tag itself rather than a tag under it. */
  own: ImagePhoto[];
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

/** The newest few photos with images tagged with the tag itself, not counting the tags under it. */
function ownPreviews(tag: Group, all: Photo[]): ImagePhoto[] {
  const tagged = all.filter((photo) => photo.tags.includes(tag.id));
  return newestWithImages(tagged).slice(0, PREVIEW_COUNT);
}

/** How the Tags page orders tags: by name, or by how many photos they have, most first. */
export type TagSort = "name" | "count";

/** By name. */
function byName(a: TagEntry, b: TagEntry): number {
  return a.tag.name.localeCompare(b.tag.name);
}

/** Most photos first, then by name. */
function byCount(a: TagEntry, b: TagEntry): number {
  return b.count - a.count || byName(a, b);
}

/** Each sort's comparison. */
const COMPARE: Record<TagSort, (a: TagEntry, b: TagEntry) => number> = {
  name: byName,
  count: byCount,
};

/** The tags without a parent tag, counting ones whose parent isn't a tag. */
function topTags(): Group[] {
  const known = new Set(tags.map((tag) => tag.id));
  return tags.filter((tag) => !known.has(tag.parent ?? "") || tag.parent === tag.id);
}

/** How a walk down the tags orders them and which photos it counts. */
interface Walk {
  sort: TagSort;
  all: Photo[];
  /** The tags already reached, so a loop of parents stops where it comes back round. */
  seen: Set<string>;
}

/**
 * Every tag under the tag, however deep, in the walk's order with each one's own tags right after
 * it, and the tags between. A tag in a loop of parents is left out.
 */
function descendants(parent: Group, between: Group[], walk: Walk): TagEntry[] {
  const fresh = subTags(parent.id).filter((tag) => !walk.seen.has(tag.id));
  for (const tag of fresh) walk.seen.add(tag.id);
  return fresh
    .map((tag) => entryOf(tag, between, walk.all))
    .toSorted(COMPARE[walk.sort])
    .flatMap((entry) => [entry, ...descendants(entry.tag, [...between, entry.tag], walk)]);
}

/** Leaves out the tags without photos. */
function withPhotos(entries: TagEntry[]): TagEntry[] {
  return entries.filter((entry) => entry.count > 0);
}

/**
 * Every top-level tag with photos in the sort's order, each with the tags under it that have
 * photos, in the same order among the tags beside them. A tag with none under it has no children.
 */
export function tagSections(sort: TagSort = "name", all: Photo[] = photos): TagSection[] {
  const tops = withPhotos(topTags().map((tag) => entryOf(tag, [], all))).toSorted(COMPARE[sort]);
  return tops.map((parent) => ({
    parent,
    own: ownPreviews(parent.tag, all),
    children: withPhotos(
      descendants(parent.tag, [], { sort, all, seen: new Set([parent.tag.id]) }),
    ),
  }));
}
