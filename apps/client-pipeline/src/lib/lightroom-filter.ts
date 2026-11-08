import type { LightroomAlbum, LightroomItem } from "@/lib/lightroom-albums";

/**
 * Whether the album has the searched text in its name, its folder path or its notes, ignoring case.
 * Empty text matches every album.
 */
export function matchesSearch(album: LightroomAlbum, search: string): boolean {
  const text = search.trim().toLowerCase();
  if (!text) return true;
  return `${album.path}\n${album.notes}`.toLowerCase().includes(text);
}

/** The tree with only the albums `keep` says yes to, keeping a folder only when an album inside it is kept. */
export function filterTree(
  items: LightroomItem[],
  keep: (album: LightroomAlbum) => boolean,
): LightroomItem[] {
  return items.flatMap((item): LightroomItem[] => {
    if (item.kind === "album") return keep(item) ? [item] : [];
    const children = filterTree(item.children, keep);
    return children.length > 0 ? [{ ...item, children }] : [];
  });
}
