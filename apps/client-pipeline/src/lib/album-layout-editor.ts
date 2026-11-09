import type { AlbumRow, Group } from "@/api/organize";

/** The most cover photos an album can have. */
export const MAX_COVERS = 5;

/** The most photos one row of an album's layout can have side by side. */
export const MAX_ROW_PHOTOS = 4;

/** What an exported album file says it is in its `format`, so an import can tell it's one. */
const ALBUM_FILE_FORMAT = "servenup-album";

/** The version of the exported album file's shape; an import refuses a newer one. */
const ALBUM_FILE_VERSION = 1;

/** An album's cover photos and rows, edited together on its page. */
export interface AlbumLayout {
  /** The IDs of up to 5 photos that stand for the album on the portfolio's Albums page. */
  covers: number[];
  /** The album's rows of photos with Markdown text above and below each. */
  layout: AlbumRow[];
}

/** The album's covers and layout as its file has them, empty when it has none. */
export function savedLayout(album: Group): AlbumLayout {
  return { covers: album.covers ?? [], layout: album.layout ?? [] };
}

/** Whether two layouts would save the same file. */
export function sameLayout(a: AlbumLayout, b: AlbumLayout): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A row with no text and no photos yet, to fill in. */
export const EMPTY_ROW: AlbumRow = { textAbove: "", photos: [], textBelow: "" };

/** The IDs of every photo in one of the rows. */
export function placedIds(layout: readonly AlbumRow[]): Set<number> {
  return new Set(layout.flatMap((row) => row.photos));
}

/** The rows with the one at place changed by update, the others as they were. */
export function withRow(
  layout: readonly AlbumRow[],
  place: number,
  update: (row: AlbumRow) => AlbumRow,
): AlbumRow[] {
  return layout.map((row, i) => (i === place ? update(row) : row));
}

/** Whether a row has neither photos nor text, which can't be saved. */
export function emptyRow(row: AlbumRow): boolean {
  return row.photos.length === 0 && !row.textAbove.trim() && !row.textBelow.trim();
}

/**
 * The album as a file to export: what it is (`format` and `version`), its ID, name, description
 * and parent for reference, then its covers and layout, the parts an import reads back.
 */
export function albumExportText(album: Group, layout: AlbumLayout): string {
  const file = {
    format: ALBUM_FILE_FORMAT,
    version: ALBUM_FILE_VERSION,
    id: album.id,
    name: album.name,
    description: album.description ?? "",
    parent: album.parent ?? null,
    ...layout,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** What reading an album file to import gave: its covers and layout with notes on what changed, or why it can't be used. */
export type AlbumImport = { layout: AlbumLayout; notes: string[] } | { error: string };

/** Thrown while reading an album file to import, with a message to show. */
class ImportError extends Error {}

/**
 * Reads text, an exported album file or an album's own JSON file, into covers and a layout for
 * album, whose photos have the IDs inAlbum. Photos not in the album, or listed twice, are left out
 * with a note, as are covers past the fifth; a row with more than 4 photos, or a file without
 * covers or a layout, is refused.
 */
export function readAlbumImport(text: string, album: Group, inAlbum: Set<number>): AlbumImport {
  try {
    const file = albumFile(text);
    const notes = fromOtherAlbum(file, album);
    const covers = importedCovers(file.covers, keeper(inAlbum, notes), notes);
    const layout = importedRows(file.layout, keeper(inAlbum, notes));
    return { layout: { covers, layout }, notes: [...new Set(notes)] };
  } catch (error) {
    if (error instanceof ImportError) return { error: error.message };
    throw error;
  }
}

/** The parsed album file, refusing text that isn't one. */
function albumFile(text: string): Record<string, unknown> {
  const file = parsed(text);
  if (!isObject(file))
    throw new ImportError("An album file is a JSON object, with { … } around it.");
  checkFormat(file);
  if (file.covers === undefined && file.layout === undefined) {
    throw new ImportError("It has no covers or layout to use.");
  }
  return file;
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ImportError(`That isn't JSON: ${(error as Error).message}`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Refuses a file that says it's something other than an album file, or a newer one. */
function checkFormat({ format, version }: Record<string, unknown>) {
  if (![undefined, ALBUM_FILE_FORMAT].includes(format as string | undefined)) {
    throw new ImportError(`It says it's “${String(format)}”, not an album file.`);
  }
  if (Number(version ?? 0) > ALBUM_FILE_VERSION) {
    throw new ImportError(`It's version ${String(version)}; this app reads version 1.`);
  }
}

/** A note when the file is another album's, whose covers and layout go on this one. */
function fromOtherAlbum(file: Record<string, unknown>, album: Group): string[] {
  if (typeof file.id !== "string" || file.id === album.id) return [];
  return [`It's from the album “${file.id}”; its covers and layout will be used for this one.`];
}

/**
 * Says whether to keep each photo ID: one in the album not kept already, noting the ones left
 * out. Each call starts its own list of kept IDs.
 */
function keeper(inAlbum: Set<number>, notes: string[]) {
  const seen = new Set<number>();
  return (id: number) => {
    if (!inAlbum.has(id)) notes.push("Photos that aren't in this album were left out.");
    if (seen.has(id)) notes.push("Photos listed twice were kept only the first time.");
    const kept = inAlbum.has(id) && !seen.has(id);
    seen.add(id);
    return kept;
  };
}

/** The file's covers that are kept, at most 5, noting when there were more. */
function importedCovers(value: unknown, keep: (id: number) => boolean, notes: string[]): number[] {
  const covers = photoIds(value ?? [], "covers").filter(keep);
  if (covers.length > MAX_COVERS) notes.push(`Only the first ${MAX_COVERS} covers were kept.`);
  return covers.slice(0, MAX_COVERS);
}

/** The file's rows, with photos it doesn't keep left out and rows left empty dropped. */
function importedRows(value: unknown, keep: (id: number) => boolean): AlbumRow[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ImportError("Its layout isn't a list of rows.");
  return value
    .map((row, i) => importedRow(row, i + 1))
    .map((row) => ({ ...row, photos: row.photos.filter(keep) }))
    .filter((row) => !emptyRow(row));
}

/** The nth row, read as written, refusing one that isn't a row. */
function importedRow(row: unknown, n: number): AlbumRow {
  if (!isObject(row)) throw new ImportError(`Row ${n} isn't an object.`);
  const photos = photoIds(row.photos ?? [], `row ${n}'s photos`);
  if (photos.length > MAX_ROW_PHOTOS) {
    throw new ImportError(`Row ${n} has ${photos.length} photos; a row can have at most 4.`);
  }
  return { textAbove: text(row.textAbove, n), photos, textBelow: text(row.textBelow, n) };
}

/** A row's text, or "" when it has none. */
function text(value: unknown, n: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ImportError(`Row ${n}'s text isn't a string.`);
  return value;
}

/** The list of photo IDs, refusing anything else. */
function photoIds(value: unknown, what: string): number[] {
  if (!Array.isArray(value) || !value.every((id) => Number.isInteger(id) && id > 0)) {
    throw new ImportError(`Its ${what} aren't a list of photo IDs, such as [12, 3].`);
  }
  return value as number[];
}

/** Saves text as a file named name on this computer, through the browser's download. */
export function downloadFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
