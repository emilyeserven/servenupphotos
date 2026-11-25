import { albumDescendants } from "@/api/organize";
import type { SocialPhoto } from "@/api/publish";
import { photoIdOf } from "@/lib/photo-sets";

/** An album as a photo book reads it from ALLALBUMS.json. */
export interface BookAlbum {
  id: string;
  name: string;
  /** The album it's inside, by ID; absent or null at the top level. */
  parent?: string | null;
  /** Its photos' IDs in the order the portfolio shows them; absent for the default order. */
  photoOrder?: number[];
}

/** The album and every album inside it, at any depth, by ID. */
export function albumAndInside(albums: BookAlbum[], id: string): Set<string> {
  const nested = albums.map((album) => ({ id: album.id, parent: album.parent ?? undefined }));
  return new Set([id, ...albumDescendants(nested, id)]);
}

/**
 * The photo files of ordered, ALLPHOTOS.json entries in the order a photo book's album shows them,
 * matched by their IDs; an entry with no file, or no ID, is left out.
 */
export function filesInOrder(
  files: SocialPhoto[],
  ordered: Record<string, unknown>[],
): SocialPhoto[] {
  const byId = new Map(files.map((file) => [photoIdOf(file), file]));
  return ordered.flatMap((entry) => {
    const file = typeof entry.id === "number" ? byId.get(entry.id) : undefined;
    return file ? [file] : [];
  });
}
