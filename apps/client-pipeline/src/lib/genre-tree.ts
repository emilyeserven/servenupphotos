import { type GenreTreeEntry, type Group, albumDescendants, albumTree } from "@/api/organize";

/** One genre as Reorganize Genres lists it: the entry and how many levels down it sits. */
export interface GenreTreeRow {
  entry: GenreTreeEntry;
  /** 0 for a top-level genre, 1 for a subgenre, and so on. */
  depth: number;
}

/** The entries whose parent is `parent`, in their order; "" is the top level. */
function childrenOf(entries: GenreTreeEntry[], parent: string): GenreTreeEntry[] {
  return entries.filter((entry) => entry.parent === parent && entry.id !== parent);
}

/**
 * entries with each genre's subgenres right after it, in their order, and how deep each sits. A
 * genre whose parent is missing, or that's in a loop of parents, is listed at the top level.
 */
export function genreTreeRows(entries: GenreTreeEntry[]): GenreTreeRow[] {
  return albumTree(entries).map(({ group, depth }) => ({ entry: group, depth }));
}

/** entries in the order the tree lists them, each genre's subgenres right after it. */
function inTreeOrder(entries: GenreTreeEntry[]): GenreTreeEntry[] {
  return genreTreeRows(entries).map((row) => row.entry);
}

/**
 * The readable genres as Reorganize Genres starts from them: in their saved order, each one's
 * subgenres after it, and a parent that isn't a readable genre counted as none.
 */
export function genreDraft(genres: Group[]): GenreTreeEntry[] {
  const readable = genres.filter((genre) => !genre.error);
  const ids = new Set(readable.map((genre) => genre.id));
  return inTreeOrder(
    readable.map((genre) => ({
      id: genre.id,
      name: genre.name,
      parent: genre.parent && ids.has(genre.parent) ? genre.parent : "",
    })),
  );
}

/** The IDs of the genres under `id`, at any depth, never `id` itself. */
export function genreDescendants(entries: GenreTreeEntry[], id: string): Set<string> {
  return albumDescendants(entries, id);
}

/** The genre's neighbor among the genres with the same parent, `by` places away. */
function sibling(entries: GenreTreeEntry[], entry: GenreTreeEntry, by: number) {
  const siblings = childrenOf(entries, entry.parent);
  return siblings[siblings.indexOf(entry) + by];
}

/**
 * entries after moving the genre `id`, with its subgenres, one place up (-1) or down (1) among the
 * genres with the same parent; the same list when it can't move that way.
 */
export function moveGenre(entries: GenreTreeEntry[], id: string, by: -1 | 1): GenreTreeEntry[] {
  const entry = entries.find((e) => e.id === id);
  const neighbor = entry && sibling(entries, entry, by);
  if (!entry || !neighbor) return entries;
  const swapped = entries
    .with(entries.indexOf(entry), neighbor)
    .with(entries.indexOf(neighbor), entry);
  return inTreeOrder(swapped);
}

/** Whether the genre can move one place up (-1) or down (1) among the genres with the same parent. */
export function canMoveGenre(entries: GenreTreeEntry[], id: string, by: -1 | 1): boolean {
  const entry = entries.find((e) => e.id === id);
  return Boolean(entry && sibling(entries, entry, by));
}

/**
 * entries with the genre `id` put under `parent` ("" for the top level) as its last subgenre,
 * keeping its own subgenres under it; the same list when `parent` is the genre itself or one of
 * its subgenres.
 */
export function moveGenreUnder(
  entries: GenreTreeEntry[],
  id: string,
  parent: string,
): GenreTreeEntry[] {
  const entry = entries.find((e) => e.id === id);
  if (!entry || entry.parent === parent) return entries;
  if (parent === id || genreDescendants(entries, id).has(parent)) return entries;
  const rest = entries.filter((e) => e !== entry);
  return inTreeOrder([...rest, { ...entry, parent }]);
}

/** The genre just above `id` with the same parent, which indenting puts it under; undefined at the top. */
export function genreAbove(entries: GenreTreeEntry[], id: string): GenreTreeEntry | undefined {
  const entry = entries.find((e) => e.id === id);
  return entry && sibling(entries, entry, -1);
}

/**
 * entries with the genre `id` moved out of its parent, to sit right after it one level up; the
 * same list for a top-level genre.
 */
export function outdentGenre(entries: GenreTreeEntry[], id: string): GenreTreeEntry[] {
  const entry = entries.find((e) => e.id === id);
  const parent = entry && entries.find((e) => e.id === entry.parent);
  if (!entry || !parent) return entries;
  const rest = entries.filter((e) => e !== entry);
  const moved = { ...entry, parent: parent.parent };
  return inTreeOrder(rest.toSpliced(rest.indexOf(parent) + 1, 0, moved));
}

/** entries with the genre `id` named `name`, as typed. */
export function renameGenre(entries: GenreTreeEntry[], id: string, name: string): GenreTreeEntry[] {
  return entries.map((entry) => (entry.id === id ? { ...entry, name } : entry));
}

/** Whether the draft differs from what was saved: a genre's place, parent or name. */
export function genreTreeChanged(saved: GenreTreeEntry[], draft: GenreTreeEntry[]): boolean {
  return (
    saved.length !== draft.length ||
    draft.some((entry, i) => {
      const before = saved[i];
      return (
        !before ||
        entry.id !== before.id ||
        entry.parent !== before.parent ||
        entry.name.trim() !== before.name
      );
    })
  );
}

/** Why the draft can't be saved yet, such as a genre with no name, or "" when it can. */
export function genreTreeProblem(draft: GenreTreeEntry[]): string {
  const seen = new Set<string>();
  for (const entry of draft) {
    const name = entry.name.trim();
    if (!name) return `Give the genre ${entry.id} a name.`;
    if (seen.has(name.toLowerCase()))
      return `Two genres are named “${name}”. Give each its own name.`;
    seen.add(name.toLowerCase());
  }
  return "";
}
