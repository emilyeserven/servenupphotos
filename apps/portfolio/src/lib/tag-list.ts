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
  /**
   * The newest few photos tagged with the parent tag itself rather than a tag under it, leaving
   * out the ones a card for a tag under it already previews.
   */
  own: ImagePhoto[];
  /**
   * The tags under it. Each one's previews leave out the photos a card for a tag under that one
   * already previews, so a photo shows once in the section where others can fill its place.
   */
  children: TagEntry[];
}

/** How many photos a tag's card previews. */
const PREVIEW_COUNT = 3;

/** How many photos a Spotlight Tags card previews: twice as many, as it's twice as wide. */
const SPOTLIGHT_PREVIEW_COUNT = 6;

/** The photos with the tag or a tag under it. */
function taggedUnder(tag: Group, all: Photo[]): Photo[] {
  const ids = tagAndSubTags(tag.id);
  return all.filter((photo) => photo.tags.some((id) => ids.has(id)));
}

/** The newest few of the photos with images, skipping the ones already shown elsewhere. */
function newestFew(
  tagged: Photo[],
  shown: ReadonlySet<number> = new Set(),
  few = PREVIEW_COUNT,
): ImagePhoto[] {
  return newestWithImages(tagged)
    .filter((photo) => !shown.has(photo.id))
    .slice(0, few);
}

/** The tag with its photo count and previews, from the photos given. */
function entryOf(tag: Group, between: Group[], all: Photo[], few = PREVIEW_COUNT): TagEntry {
  const tagged = taggedUnder(tag, all);
  return { tag, between, count: tagged.length, previews: newestFew(tagged, new Set(), few) };
}

/** The ids of the photos the entries preview. */
function previewedIds(entries: TagEntry[]): Set<number> {
  return new Set(entries.flatMap((entry) => entry.previews.map((photo) => photo.id)));
}

/** The entries under the tag: the ones that name it among the tags between. */
function entriesUnder(tag: Group, entries: TagEntry[]): TagEntry[] {
  return entries.filter((entry) => entry.between.some((group) => group.id === tag.id));
}

/**
 * The section's entries with each one's previews leaving out the photos the entries under it
 * preview. The deepest come first, so a tag's card keeps its newest photos and the cards above it
 * fill with the next ones.
 */
function withoutRepeats(entries: TagEntry[], all: Photo[]): TagEntry[] {
  return entries.reduceRight<TagEntry[]>((after, entry) => {
    const shown = previewedIds(entriesUnder(entry.tag, after));
    const previews = newestFew(taggedUnder(entry.tag, all), shown);
    return [{ ...entry, previews }, ...after];
  }, []);
}

/**
 * The newest few photos with images tagged with the tag itself, not counting the tags under it,
 * leaving out the ones the cards for the tags under it preview.
 */
function ownPreviews(tag: Group, all: Photo[], children: TagEntry[]): ImagePhoto[] {
  const tagged = all.filter((photo) => photo.tags.includes(tag.id));
  return newestFew(tagged, previewedIds(children));
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
  return tops.map((parent) => sectionOf(parent, sort, all));
}

/** The parent tag's section, its cards' previews without repeats. */
function sectionOf(parent: TagEntry, sort: TagSort, all: Photo[]): TagSection {
  const walk = { sort, all, seen: new Set([parent.tag.id]) };
  const children = withoutRepeats(withPhotos(descendants(parent.tag, [], walk)), all);
  return { parent, own: ownPreviews(parent.tag, all, children), children };
}

/**
 * Every favorite tag with photos, in the sort's order, for the Spotlight Tags at the top of the
 * Tags page, each with up to 6 previews.
 */
export function favoriteTags(sort: TagSort = "name", all: Photo[] = photos): TagEntry[] {
  const favorites = tags
    .filter((tag) => tag.favorite)
    .map((tag) => entryOf(tag, [], all, SPOTLIGHT_PREVIEW_COUNT));
  return withPhotos(favorites).toSorted(COMPARE[sort]);
}
