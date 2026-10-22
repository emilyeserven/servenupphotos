import committedAlbums from "@/data/albums/ALLALBUMS.json";
import committedTags from "@/data/tags/ALLTAGS.json";
import { localFile } from "@/lib/localize";

/** An album or tag from ALLALBUMS.json or ALLTAGS.json, which photos list by ID. */
export interface Group {
  id: string;
  name: string;
  description?: string;
  /** For an album, the ID of the album it's a sub-album of; missing or "" at the top. */
  parent?: string;
}

// Like ALLPHOTOS.local.json, these are git-ignored and only there locally; a glob doesn't fail
// when they're missing.
/** Every album, from ALLALBUMS.json. */
export const albums: Group[] =
  localFile(
    import.meta.glob<Group[]>("../data/albums/ALLALBUMS.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedAlbums as Group[]);

/** Every tag, from ALLTAGS.json. */
export const tags: Group[] =
  localFile(
    import.meta.glob<Group[]>("../data/tags/ALLTAGS.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedTags as Group[]);

/** The albums directly inside the album with the ID, or the top-level albums for "". */
export function subAlbums(parent: string): Group[] {
  return albums.filter((album) => (album.parent ?? "") === parent && album.id !== parent);
}

/**
 * The album's ID and the IDs of every album inside it, however deep, so a photo in a sub-album
 * counts as in the album too. A loop of parents stops where it comes back round.
 */
export function albumAndSubAlbums(id: string, found = new Set<string>()): Set<string> {
  if (found.has(id)) return found;
  found.add(id);
  for (const album of subAlbums(id)) albumAndSubAlbums(album.id, found);
  return found;
}
