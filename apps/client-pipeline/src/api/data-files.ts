import { mutationOptions } from "@tanstack/react-query";
import type { CombinedData } from "@/api/photos";
import { entryId } from "@/api/places";
import { del, put } from "@/api/request";
import type { FileChange } from "@/lib/optimistic";

/** A kind of setting file saved one per entry and combined by Commit: camera overrides, lens overrides, custom lenses, caption templates, Trips, viewer likes, trip lines, graph presets, gear pictures, Not Stored posts, photo books, the photo books' standard layouts, the bio or Photo Sets. */
type SettingKind =
  | "cameras"
  | "lensoverrides"
  | "lenses"
  | "captions"
  | "timeline"
  | "likes"
  | "triplines"
  | "graphs"
  | "gear"
  | "notstored"
  | "photobooks"
  | "booklayouts"
  | "bio"
  | "sets";

/** What saving or removing a setting file did; nothing is saved when it already had that content. */
interface SettingResult<T> {
  path: string;
  /** The file as saved, or null when it was removed. */
  data: T | null;
  /** The file before, or null when it's new. */
  before: T | null;
  changed: boolean;
}

/** The change a save or removal made, for the combined lists; a new file has no `before`. */
function settingChange<T>(
  kind: SettingKind,
  { path, data, before }: SettingResult<T>,
): FileChange[] {
  const change: FileChange = { kind, path, after: data };
  return [before === null ? change : { ...change, before }];
}

function settingMeta<T>(kind: SettingKind) {
  return {
    saves: (result: unknown) => (result as SettingResult<T>).changed,
    changes: (result: unknown) => settingChange(kind, result as SettingResult<T>),
  };
}

/**
 * Saving a setting file, new or changed, and removing one, each as a change waiting for Commit.
 * `route` is the backend's path for them when it isn't the kind's, as for Trips, kept in the
 * timeline folder.
 */
export function settingMutations<T extends { id: string }>(
  kind: SettingKind,
  route: string = kind,
) {
  const url = (id: string) => `/api/${route}/${encodeURIComponent(id)}`;
  return {
    save: mutationOptions({
      mutationKey: [route, "save"],
      scope: { id: "photo-data-entries" },
      meta: settingMeta<T>(kind),
      mutationFn: (entry: T) => put<SettingResult<T>>(url(entry.id), entry),
    }),
    remove: mutationOptions({
      mutationKey: [route, "delete"],
      scope: { id: "photo-data-entries" },
      meta: settingMeta<T>(kind),
      mutationFn: (id: string) => del<SettingResult<T>>(url(id)),
    }),
  };
}

/** The lists Commit starts from: at the pull request's head, or else on the base branch. */
function nextLists(data: CombinedData | undefined) {
  return data?.head ?? data?.base;
}

/** The entries of a kind's file as the next Commit will have them; none while the lists aren't read. */
function fileEntries(data: CombinedData | undefined, kind: SettingKind): unknown[] {
  return nextLists(data)?.[kind]?.data ?? [];
}

/** Orders setting entries by name, for kinds the pages list that way. */
export function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

/**
 * A kind's entries as the next Commit will have them: its file with the changes since, keeping
 * those `isEntry` accepts. They keep the file's order unless `compare` sorts them.
 */
export function settingEntries<T>(
  kind: SettingKind,
  isEntry: (value: unknown) => value is T,
  compare?: (a: T, b: T) => number,
) {
  return (data: CombinedData | undefined): T[] => {
    const entries = fileEntries(data, kind).filter(isEntry);
    return compare ? entries.toSorted(compare) : entries;
  };
}

/**
 * The ID a new entry named name gets, such as `korea-2026`, or `fallback` for a name with no
 * letters, with -2, -3 and so on after it while one of taken has it already.
 */
export function uniqueEntryId(name: string, taken: string[], fallback: string): string {
  const base = entryId(name).slice(0, 90).replace(/-+$/, "") || fallback;
  let id = base;
  for (let n = 2; taken.includes(id); n += 1) id = `${base}-${n}`;
  return id;
}
