import promptText from "@/lib/lightroom-albums-prompt.md?raw";

/** The prompt to send an LLM with screenshots of Lightroom's album panel, asking for the albums as JSON. */
export const lightroomAlbumsPrompt = promptText;

/** The stages an album can be at, in the order work on an album usually goes. */
export const LIGHTROOM_STAGES = [
  "Not started",
  "Culling",
  "Editing",
  "Ready to upload",
  "Uploaded",
  "Done",
] as const;

/** One of the stages an album can be at. */
export type LightroomStage = (typeof LIGHTROOM_STAGES)[number];

/** A Lightroom album (a collection, in Lightroom Classic) with the stage and notes the photographer gave it. */
export interface LightroomAlbum {
  kind: "album";
  /** The album's name, as Lightroom shows it. */
  name: string;
  /** Every name from the top of the tree down to the album, joined with "/", which matches it again on the next import. */
  path: string;
  /** How many photos Lightroom says the album has, or null when it wasn't shown. */
  photoCount: number | null;
  /** Whether it's a Smart Collection. */
  smart: boolean;
  /** Which stage the album is at, or null before one is picked. */
  stage: LightroomStage | null;
  /** The photographer's notes on the album. */
  notes: string;
  /** Why the LLM wasn't sure it read the album right, when it wasn't. */
  uncertainNote?: string;
}

/** A Lightroom folder (a collection set, in Lightroom Classic) and what's inside it. */
export interface LightroomFolder {
  kind: "folder";
  /** The folder's name, as Lightroom shows it. */
  name: string;
  /** Every name from the top of the tree down to the folder, joined with "/". */
  path: string;
  /** The folders and albums inside it. */
  children: LightroomItem[];
  /** Whether it was closed in the screenshots, so what's inside it wasn't read. */
  collapsed: boolean;
  /** Why the LLM wasn't sure it read the folder right, when it wasn't. */
  uncertainNote?: string;
}

/** A folder or an album in the Lightroom album tree. */
export type LightroomItem = LightroomAlbum | LightroomFolder;

/** The Lightroom album tree, as the page keeps it in the browser and exports it. */
export interface LightroomAlbumsFile {
  /** Which Lightroom the screenshots were of: "lightroom-classic", "lightroom" or "unknown". */
  source: string;
  /** When the list was last imported or exported. */
  updatedAt: string;
  items: LightroomItem[];
}

/** The JSON object in pasted text, from its first `{` to its last `}`, so a code block or words around it are fine. */
function jsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("There's no JSON object in it.");
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("The JSON couldn't be read. Check it's the whole answer or file.");
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stage(value: unknown): LightroomStage | null {
  return LIGHTROOM_STAGES.find((s) => s === value) ?? null;
}

/** The uncertain note, kept when the item was marked uncertain (an LLM answer) or has one (an exported file). */
function uncertainty(raw: Record<string, unknown>): { uncertainNote?: string } {
  if (raw.uncertain !== true && !text(raw.uncertainNote)) return {};
  return { uncertainNote: text(raw.uncertainNote) || "Not sure it was read right." };
}

/** The item's path, made from its parent's when the JSON doesn't have one. */
function itemPath(raw: Record<string, unknown>, name: string, parent: string): string {
  return text(raw.path) || (parent ? `${parent}/${name}` : name);
}

function readAlbum(raw: Record<string, unknown>, name: string, path: string): LightroomAlbum {
  return {
    kind: "album",
    name,
    path,
    photoCount: count(raw.photoCount),
    smart: raw.smart === true,
    stage: stage(raw.stage),
    notes: text(raw.notes),
    ...uncertainty(raw),
  };
}

function readFolder(raw: Record<string, unknown>, name: string, path: string): LightroomFolder {
  return {
    kind: "folder",
    name,
    path,
    children: readItems(raw.children, path),
    collapsed: raw.collapsed === true,
    ...uncertainty(raw),
  };
}

/** The value as an object to read fields from, or an empty one when it isn't an object. */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readItem(value: unknown, parent: string): LightroomItem | null {
  const raw = asRecord(value);
  const name = text(raw.name).trim();
  if (!name) return null;
  const path = itemPath(raw, name, parent);
  return raw.kind === "folder" ? readFolder(raw, name, path) : readAlbum(raw, name, path);
}

function readItems(value: unknown, parent: string): LightroomItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => readItem(v, parent)).filter((item) => item !== null);
}

/**
 * Reads the album tree from an LLM's answer to the prompt or from a file this page exported, which have the same
 * shape. Throws an error a person can read when there's no tree in it.
 */
export function readLightroomAlbums(input: string): LightroomAlbumsFile {
  const raw = jsonObject(input);
  if (!Array.isArray(raw.items)) throw new Error(`The JSON has no "items" list.`);
  const items = readItems(raw.items, "");
  if (items.length === 0) throw new Error("The list has no folders or albums in it.");
  return { source: text(raw.source) || "unknown", updatedAt: new Date().toISOString(), items };
}

/** Every album in the tree, folders left out, from top to bottom. */
export function allAlbums(items: LightroomItem[]): LightroomAlbum[] {
  return items.flatMap((item) => (item.kind === "album" ? [item] : allAlbums(item.children)));
}

/** Whether the photographer has given the album a stage or notes. */
function hasWork(album: LightroomAlbum): boolean {
  return album.stage !== null || album.notes.trim() !== "";
}

/** The album with the old album's stage and notes in place of any it doesn't have itself. */
function keepWork(album: LightroomAlbum, old: LightroomAlbum | undefined): LightroomAlbum {
  if (!old) return album;
  return { ...album, stage: album.stage ?? old.stage, notes: album.notes || old.notes };
}

function mergeItem(item: LightroomItem, old: Map<string, LightroomAlbum>): LightroomItem {
  if (item.kind === "album") return keepWork(item, old.get(item.path));
  return { ...item, children: item.children.map((child) => mergeItem(child, old)) };
}

/** What importing a new list does to the albums already on the page. */
export interface LightroomMerge {
  /** The new tree, with the stage and notes of every album that's in both. */
  items: LightroomItem[];
  /** How many albums are new. */
  added: number;
  /** How many albums were matched by path and kept their stage and notes. */
  kept: number;
  /** Albums with a stage or notes that aren't in the new list, so they're dropped along with their notes. */
  dropped: LightroomAlbum[];
}

/**
 * Puts the imported tree in place of the current one, matching albums by path. An album keeps its current stage and
 * notes unless the import has its own (an exported file does, an LLM answer doesn't).
 */
export function mergeLightroomAlbums(
  current: LightroomItem[],
  imported: LightroomItem[],
): LightroomMerge {
  const old = new Map(allAlbums(current).map((album) => [album.path, album]));
  const items = imported.map((item) => mergeItem(item, old));
  const paths = new Set(allAlbums(items).map((album) => album.path));
  const kept = [...paths].filter((path) => old.has(path)).length;
  return {
    items,
    added: paths.size - kept,
    kept,
    dropped: [...old.values()].filter((album) => !paths.has(album.path) && hasWork(album)),
  };
}

/** Changes one album, found by path, anywhere in the tree. */
export function updateAlbum(
  items: LightroomItem[],
  path: string,
  change: Partial<Pick<LightroomAlbum, "stage" | "notes">>,
): LightroomItem[] {
  return items.map((item) => {
    if (item.kind === "folder")
      return { ...item, children: updateAlbum(item.children, path, change) };
    return item.path === path ? { ...item, ...change } : item;
  });
}
