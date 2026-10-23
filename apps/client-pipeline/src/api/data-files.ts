import { mutationOptions } from "@tanstack/react-query";
import { requestJson } from "@/api/settings";
import type { FileChange } from "@/lib/optimistic";

/** A kind of setting file saved one per entry and combined by Commit: camera overrides or custom lenses. */
type SettingKind = "cameras" | "lenses";

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

/** Saving a setting file, new or changed, and removing one, each as a change waiting for Commit. */
export function settingMutations<T extends { id: string }>(kind: SettingKind) {
  const url = (id: string) => `/api/${kind}/${encodeURIComponent(id)}`;
  return {
    save: mutationOptions({
      mutationKey: [kind, "save"],
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
      mutationKey: [kind, "delete"],
      scope: { id: "photo-data-entries" },
      meta: settingMeta<T>(kind),
      mutationFn: (id: string) => requestJson<SettingResult<T>>(url(id), { method: "DELETE" }),
    }),
  };
}
