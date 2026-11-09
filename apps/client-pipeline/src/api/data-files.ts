import { mutationOptions } from "@tanstack/react-query";
import { requestJson } from "@/api/request";
import type { CombinedData } from "@/api/photos";
import type { FileChange } from "@/lib/optimistic";

/** A kind of setting file saved one per entry and combined by Commit: camera overrides, custom lenses, caption templates, Trips, viewer likes, trip lines, graph presets or gear pictures. */
type SettingKind =
  | "cameras"
  | "lenses"
  | "captions"
  | "timeline"
  | "likes"
  | "triplines"
  | "graphs"
  | "gear";

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
      mutationFn: (entry: T) =>
        requestJson<SettingResult<T>>(url(entry.id), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(entry),
        }),
    }),
    remove: mutationOptions({
      mutationKey: [route, "delete"],
      scope: { id: "photo-data-entries" },
      meta: settingMeta<T>(kind),
      mutationFn: (id: string) => requestJson<SettingResult<T>>(url(id), { method: "DELETE" }),
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
