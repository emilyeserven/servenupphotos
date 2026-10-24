import type { Group } from "@/api/organize";

/** The ID of the album's parent among albums, or "" when it's at the top level. */
function placedParent(albums: Group[], album: Group): string {
  const parent = album.parent ?? "";
  return albums.some((a) => a.id === parent) ? parent : "";
}

/**
 * Every readable album's ID in its new order after moving the album `id` one place up (-1) or down
 * (1) among the albums in the same parent; empty when it can't move that way. albums are in their
 * order, as the backend lists them.
 */
export function movedAlbumOrder(albums: Group[], id: string, by: -1 | 1): string[] {
  const readable = albums.filter((album) => !album.error);
  const album = readable.find((a) => a.id === id);
  if (!album) return [];
  const parent = placedParent(readable, album);
  const siblings = readable.filter((a) => placedParent(readable, a) === parent);
  const neighbor = siblings[siblings.indexOf(album) + by];
  if (!neighbor) return [];
  const ids = readable.map((a) => a.id);
  return ids.with(ids.indexOf(id), neighbor.id).with(ids.indexOf(neighbor.id), id);
}
