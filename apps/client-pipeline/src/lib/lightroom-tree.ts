import type { LightroomAlbum, LightroomFolder, LightroomItem } from "@/lib/lightroom-albums";

/** The path of a name inside a folder, such as "Travel/Busan", or just the name at the top. */
function join(folder: string, name: string): string {
  return folder ? `${folder}/${name}` : name;
}

/** A folder path typed by hand, with spaces around each name and empty names taken out, such as "Travel/Japan". */
function cleanFolder(folder: string): string {
  return folder
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
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

/** The tree without the folder at a path, and everything inside it. */
export function removeFolder(items: LightroomItem[], path: string): LightroomItem[] {
  return items.flatMap((item): LightroomItem[] => {
    if (item.kind === "album") return [item];
    if (item.path === path) return [];
    return [{ ...item, children: removeFolder(item.children, path) }];
  });
}

/** Every folder in the tree, outer ones before the ones inside them. */
function foldersIn(items: LightroomItem[]): LightroomFolder[] {
  return items.flatMap((item) =>
    item.kind === "folder" ? [item, ...foldersIn(item.children)] : [],
  );
}

/** The folder at a path, anywhere in the tree. */
export function findFolder(items: LightroomItem[], path: string): LightroomFolder | undefined {
  return foldersIn(items).find((folder) => folder.path === path);
}

/** Every album in the tree, from top to bottom. */
function albumsIn(items: LightroomItem[]): LightroomAlbum[] {
  return items.flatMap((item) => (item.kind === "album" ? [item] : albumsIn(item.children)));
}

/** The album at a path, anywhere in the tree. */
function findAlbum(items: LightroomItem[], path: string): LightroomAlbum | undefined {
  return albumsIn(items).find((album) => album.path === path);
}

/** Where Lightroom has an album being moved: nowhere for one added by hand, else where it was before any move. */
function lightroomHome(album: LightroomAlbum): string | undefined {
  return album.manual ? undefined : (album.lightroomPath ?? album.path);
}

/** The album at its new path, remembering where Lightroom has it unless that's where it now is. */
function movedTo(album: LightroomAlbum, to: string): LightroomAlbum {
  const home = lightroomHome(album);
  const moved: LightroomAlbum = { ...album, path: to };
  delete moved.lightroomPath;
  return home && home !== to ? { ...moved, lightroomPath: home } : moved;
}

/**
 * The tree with the album at `path` moved into another folder ("" for no parent), making the folder when it isn't
 * there yet. An album read from Lightroom remembers where Lightroom has it, so a new import matches it and keeps it
 * where it was moved. Nothing changes when a folder or album already has the new path.
 */
export function moveAlbum(items: LightroomItem[], path: string, folder: string): LightroomItem[] {
  const album = findAlbum(items, path);
  if (!album) return items;
  const to = join(cleanFolder(folder), album.name);
  if (pathTaken(items, to)) return items;
  return insertAlbum(removeAlbum(items, path), movedTo(album, to));
}

/**
 * The imported tree with an album that was moved on this page put back where it was moved, keeping what the import
 * read for it. It stays where Lightroom has it when something in the import is already at the moved path.
 */
export function keepMove(items: LightroomItem[], old: LightroomAlbum): LightroomItem[] {
  const from = old.lightroomPath ?? old.path;
  const imported = findAlbum(items, from);
  if (!imported || pathTaken(items, old.path)) return items;
  return insertAlbum(removeAlbum(items, from), {
    ...imported,
    path: old.path,
    lightroomPath: from,
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
  /** How many photos it has now, or null when not known. */
  photoCount: number | null;
  /** How many photos it had before culling, or null when not noted. */
  originalCount: number | null;
  offline: boolean;
}

/** The album to add by hand, with its path from its folder and `manual` set so a new import keeps it. */
export function manualAlbum({
  name,
  folder,
  photoCount,
  originalCount,
  offline,
}: ManualAlbum): LightroomAlbum {
  const clean = cleanFolder(folder);
  return {
    kind: "album",
    name: name.trim(),
    path: join(clean, name.trim()),
    photoCount,
    originalCount,
    smart: false,
    offline,
    manual: true,
    stage: null,
    notes: "",
  };
}
