import type {
  TagLibrary,
  TagLibraryExport,
  TagLibraryFewPhotos,
  TagLibraryPhotoInfo,
  TagLibraryTag,
} from "@/api/tag-library";
import { fewPhotosLine, tagLibraryPrompt } from "@/lib/tag-library-prompt";

/** A tag with fewer photos than a tag should have, with what the Small Tags page shows of it. */
export interface SmallTag extends TagLibraryTag {
  /** How many photos have it or a tag under it, which is what filtering by it shows. */
  shown: number;
  /** The tags directly under it. */
  children: string[];
  /** The photos that list it themselves. */
  tagged: TagLibraryPhotoInfo[];
}

/** The tags directly under each tag, by its ID. */
function childrenOf(tags: TagLibraryTag[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const t of tags) {
    if (t.parent) out.set(t.parent, [...(out.get(t.parent) ?? []), t.tag]);
  }
  return out;
}

/** id and every tag under it, however deep, guarding against a loop. */
function withDescendants(id: string, children: Map<string, string[]>): Set<string> {
  const out = new Set<string>();
  const queue = [id];
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    if (out.has(next)) continue;
    out.add(next);
    queue.push(...(children.get(next) ?? []));
  }
  return out;
}

/** How many photos have any of ids. */
function photosWithAny(photos: TagLibraryPhotoInfo[], ids: ReadonlySet<string>): number {
  return photos.filter((photo) => photo.tags.some((tag) => ids.has(tag))).length;
}

/**
 * Every tag that fewer than the library's fewest photos a tag should have show when filtered by
 * (its own photos and those of the tags under it), with the fewest first, then by ID.
 */
export function smallTags(library: TagLibraryExport): SmallTag[] {
  const children = childrenOf(library.tags);
  return library.tags
    .map((t) => ({
      ...t,
      shown: photosWithAny(library.photos, withDescendants(t.tag, children)),
      children: children.get(t.tag) ?? [],
      tagged: library.photos.filter((photo) => photo.tags.includes(t.tag)),
    }))
    .filter((t) => t.shown < library.minPhotos)
    .toSorted((a, b) => a.shown - b.shown || a.tag.localeCompare(b.tag));
}

/** small as the Tag library's follow-up prompt lists a tag with too few photos. */
function asFewPhotos(small: SmallTag): TagLibraryFewPhotos {
  return {
    tag: small.tag,
    photos: small.shown,
    parent: small.parent,
    photoNames: small.tagged.map((photo) => photo.photo),
  };
}

/** A Tag library save with nothing in it, for one change to be added to. */
export function emptyLibrary(): TagLibrary {
  return {
    newTags: [],
    rename: [],
    merge: [],
    remove: [],
    reparent: [],
    describe: [],
    photos: [],
    notes: [],
  };
}

/** The note a removed tag leaves on each of its photos, unless it's changed. */
export function removalNote(small: SmallTag): string {
  const what = small.description ? ` (${small.description})` : "";
  const many = small.shown === 1 ? "only this photo had it" : `only ${small.shown} photos had it`;
  return `Had the tag "${small.tag}"${what}, removed since ${many}.`;
}

/**
 * The prompt for the Small Tags page: the Tag library's prompt, with the whole library, narrowed to
 * fixing only the small tags, so its answer can be pasted back into the same review.
 */
export function smallTagsPrompt(
  library: TagLibraryExport,
  small: SmallTag[],
  filtered: string[],
): string {
  const min = library.minPhotos;
  return `${tagLibraryPrompt(library, filtered)}
This time, don't overhaul the whole library: only fix these tags, which filtering by shows fewer than ${min} photos (each with its parent, how many photos it or a tag under it shows, and the photos that have it themselves, by file name):
${small.map(asFewPhotos).map(fewPhotosLine).join("\n")}

For each of them, do one of these:
- add it to more photos that clearly should have it, under "photos", so it shows at least ${min},
- merge it into a tag that means the same or nearly the same, or rename it when a better ID would gather more photos, or
- remove it, and add a note to each of its photos under "notes" saying which tag it was, what in the photo it described, and why it isn't a tag.

Leave every other tag and photo as it is, with the same rules as above, and answer with only the same JSON.
`;
}

/** A tag ID as typed, trimmed, lowercased and with spaces as dashes. */
export function tagId(typed: string): string {
  return typed.trim().toLowerCase().replaceAll(/\s+/g, "-");
}

/** A change to save and what to say once it's saved. */
interface SmallTagChange {
  change: TagLibrary;
  said: string;
}

/** Removing small, with note (left out when empty) on each of its photos. */
export function removeChange(small: SmallTag, note: string): SmallTagChange {
  const text = note.trim();
  const noted = text === "" ? [] : small.tagged;
  const photos = noted.length === 1 ? "1 photo" : `${noted.length} photos`;
  const said = noted.length > 0 ? ` and added a note to ${photos}` : "";
  return {
    change: {
      ...emptyLibrary(),
      remove: [small.tag],
      notes: noted.map((photo) => ({ path: photo.path, note: text })),
    },
    said: `Removed ${small.tag}${said}`,
  };
}

/** Merging tag into to when another tag has that ID, or else renaming it to to. */
export function renameChange(tag: string, to: string, merge: boolean): SmallTagChange {
  return merge
    ? {
        change: { ...emptyLibrary(), merge: [{ tag, into: to }] },
        said: `Merged ${tag} into ${to}`,
      }
    : { change: { ...emptyLibrary(), rename: [{ tag, to }] }, said: `Renamed ${tag} to ${to}` };
}
