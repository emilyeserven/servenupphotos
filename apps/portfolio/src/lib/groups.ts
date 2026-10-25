import committedAlbums from "@/data/albums/ALLALBUMS.json";
import committedGenres from "@/data/genres/ALLGENRES.json";
import committedTags from "@/data/tags/ALLTAGS.json";
import { localFile } from "@/lib/localize";

/** An album, tag or genre from ALLALBUMS.json, ALLTAGS.json or ALLGENRES.json, which photos list by ID. */
export interface Group {
  id: string;
  name: string;
  description?: string;
  /**
   * For an album, the ID of the album it's a sub-album of; for a tag, the more general tag it's a
   * kind of, such as "covered-street" for "shotengai". Missing or "" at the top.
   */
  parent?: string;
  /** For an album, its place among the albums, 1 first, set on the pipeline's Albums page. */
  order?: number;
  /** For an album, the spots on the site that show its photos, such as "homepage". */
  spotlightZones?: string[];
}

/** Ranks an album without a place in the order after every album with one. */
function rank({ order }: Group): number {
  return order ?? Number.MAX_SAFE_INTEGER;
}

/** By place in the order, ones without one after, then by name. */
function byOrder(a: Group, b: Group): number {
  return rank(a) - rank(b) || a.name.localeCompare(b.name);
}

// Like ALLPHOTOS.local.json, these are git-ignored and only there locally; a glob doesn't fail
// when they're missing.
/** Every album, from ALLALBUMS.json, in the order set on the pipeline's Albums page. */
export const albums: Group[] = (
  localFile(
    import.meta.glob<Group[]>("../data/albums/ALLALBUMS.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedAlbums as Group[])
).toSorted(byOrder);

/** Every tag, from ALLTAGS.json. */
export const tags: Group[] =
  localFile(
    import.meta.glob<Group[]>("../data/tags/ALLTAGS.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedTags as Group[]);

/** Every photographic genre, such as street or landscape, from ALLGENRES.json, by name. */
export const genres: Group[] = (
  localFile(
    import.meta.glob<Group[]>("../data/genres/ALLGENRES.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedGenres as Group[])
).toSorted((a, b) => a.name.localeCompare(b.name));

/** The albums or tags in list directly inside the one with the ID, or the top-level ones for "". */
function children(list: Group[], parent: string): Group[] {
  return list.filter((group) => (group.parent ?? "") === parent && group.id !== parent);
}

/** The ID and the IDs of every album or tag in list inside it, however deep; a loop stops where it comes back round. */
function withDescendants(list: Group[], id: string, found = new Set<string>()): Set<string> {
  if (found.has(id)) return found;
  found.add(id);
  for (const child of children(list, id)) withDescendants(list, child.id, found);
  return found;
}

/** The albums directly inside the album with the ID, or the top-level albums for "", in order. */
export function subAlbums(parent: string): Group[] {
  return children(albums, parent);
}

/**
 * The album's ID and the IDs of every album inside it, however deep, so a photo in a sub-album
 * counts as in the album too. A loop of parents stops where it comes back round.
 */
export function albumAndSubAlbums(id: string): Set<string> {
  return withDescendants(albums, id);
}

/** The tags whose parent is the tag with the ID, such as "shotengai" under "covered-street". */
export function subTags(parent: string): Group[] {
  return children(tags, parent);
}

/**
 * The tag's ID and the IDs of every tag under it, however deep, so a photo tagged "shotengai"
 * counts as tagged "covered-street" too.
 */
export function tagAndSubTags(id: string): Set<string> {
  return withDescendants(tags, id);
}

/** The top-level albums in order, counting ones whose parent isn't an album. */
function topAlbums(): Group[] {
  return albums.filter((album) => !albums.some((other) => other.id === album.parent));
}

/**
 * Every album in order, each with its sub-albums right after it, from the top level or from the
 * album with the ID parent. An album in a loop of parents is left out.
 */
export function albumTree(parent = "", seen = new Set<string>()): Group[] {
  const fresh = (parent ? subAlbums(parent) : topAlbums()).filter((a) => !seen.has(a.id));
  for (const album of fresh) seen.add(album.id);
  return fresh.flatMap((album) => [album, ...albumTree(album.id, seen)]);
}
