import type { LightroomAlbum, LightroomFolder, LightroomItem } from "@/lib/lightroom-albums";

/** The path of a name inside a folder, such as "Travel/Busan", or just the name at the top. */
function join(folder: string, name: string): string {
  return folder ? `${folder}/${name}` : name;
}

/** A new, empty folder at a path. */
function newFolder(name: string, path: string): LightroomFolder {
  return { kind: "folder", name, path, children: [], collapsed: false };
}

/** The items with the album added at the end of the folder named by `parts`, making any folder that isn't there yet. */
function insertInto(
  items: LightroomItem[],
  parts: string[],
  parent: string,
  album: LightroomAlbum,
): LightroomItem[] {
  const [name, ...rest] = parts;
  if (name === undefined) return [...items, album];
  const path = join(parent, name);
  const found = items.some((item) => item.kind === "folder" && item.path === path);
  const withFolder = found ? items : [...items, newFolder(name, path)];
  return withFolder.map((item) =>
    item.kind === "folder" && item.path === path
      ? { ...item, children: insertInto(item.children, rest, path, album) }
      : item,
  );
}

/**
 * The tree with the album added inside the folder its path names (such as "Travel/Japan" for
 * "Travel/Japan/Kyoto"), after what's already there, making the folders it needs.
 */
export function insertAlbum(items: LightroomItem[], album: LightroomAlbum): LightroomItem[] {
  const folder = album.path.slice(0, Math.max(0, album.path.length - album.name.length - 1));
  return insertInto(items, folder ? folder.split("/") : [], "", album);
}

/** The tree without the album at a path. Folders it leaves empty stay, as they do in Lightroom. */
export function removeAlbum(items: LightroomItem[], path: string): LightroomItem[] {
  return items.flatMap((item): LightroomItem[] => {
    if (item.kind === "folder") return [{ ...item, children: removeAlbum(item.children, path) }];
    return item.path === path ? [] : [item];
  });
}

/** Every folder's path in the tree, from top to bottom, such as "Travel" and "Travel/Japan". */
export function folderPaths(items: LightroomItem[]): string[] {
  return items.flatMap((item) =>
    item.kind === "folder" ? [item.path, ...folderPaths(item.children)] : [],
  );
}

/** Whether a folder or an album already has the path. */
export function pathTaken(items: LightroomItem[], path: string): boolean {
  return items.some(
    (item) => item.path === path || (item.kind === "folder" && pathTaken(item.children, path)),
  );
}

/** What's needed to add an album by hand. */
export interface ManualAlbum {
  name: string;
  /** The folder it goes in, such as "Travel/Japan", or "" for the top. */
  folder: string;
  photoCount: number | null;
  offline: boolean;
}

/** The album to add by hand, with its path from its folder and `manual` set so a new import keeps it. */
export function manualAlbum({ name, folder, photoCount, offline }: ManualAlbum): LightroomAlbum {
  const clean = folder
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
  return {
    kind: "album",
    name: name.trim(),
    path: join(clean, name.trim()),
    photoCount,
    smart: false,
    offline,
    manual: true,
    stage: null,
    notes: "",
  };
}
