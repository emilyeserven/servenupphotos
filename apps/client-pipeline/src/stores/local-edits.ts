import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FieldEdit } from "@/api/photos";

/**
 * Changes to a photo file kept in the browser until they're committed, such as an Instagram date.
 * `before` is the file's data as last read, so the change can be shown in ALLPHOTOS.json now.
 */
export interface LocalEdit {
  kind: "photos";
  path: string;
  before: Record<string, unknown>;
  fields: Record<string, unknown>;
}

/** One field to set on a photo file, with the file's data as read. */
export interface FieldChange {
  path: string;
  before: Record<string, unknown>;
  value: unknown;
}

interface LocalEditsState {
  /** By file path. */
  edits: Record<string, LocalEdit>;
  /** Sets `key` on each file in changes; a value equal to the file's own drops the change. */
  setField: (key: string, changes: FieldChange[]) => void;
  /** Drops the edits a commit saved, keeping ones made while it ran. */
  committed: (saved: Record<string, LocalEdit>) => void;
  /** Drops every edit. */
  discard: () => void;
}

/** Whether change sets key to the value the file already has. */
function isSaved(change: FieldChange, key: string): boolean {
  return JSON.stringify(change.before[key] ?? null) === JSON.stringify(change.value);
}

/** The edit with key set to value, or undefined when nothing's left to change. */
function withField(
  edit: LocalEdit | undefined,
  key: string,
  change: FieldChange,
): LocalEdit | undefined {
  const fields = { ...edit?.fields, [key]: change.value };
  if (isSaved(change, key)) delete fields[key];
  if (Object.keys(fields).length === 0) return undefined;
  return { kind: "photos", path: change.path, before: change.before, fields };
}

/**
 * Edits made in the app and not committed yet, kept in localStorage so a reload doesn't lose them.
 * **Commit** saves them to their files with ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json.
 */
export const useLocalEditsStore = create<LocalEditsState>()(
  persist(
    (set) => ({
      edits: {},
      setField: (key, changes) =>
        set((state) => {
          const edits = { ...state.edits };
          for (const change of changes) {
            const edit = withField(edits[change.path], key, change);
            if (edit) edits[change.path] = edit;
            else delete edits[change.path];
          }
          return { edits };
        }),
      committed: (saved) =>
        set((state) => ({
          edits: Object.fromEntries(
            Object.entries(state.edits).filter(([path, edit]) => saved[path] !== edit),
          ),
        })),
      discard: () => set({ edits: {} }),
    }),
    { name: "pipeline-local-edits", storage: createJSONStorage(() => localStorage) },
  ),
);

/** The edits as the backend takes them. */
export function fieldEdits(edits: Record<string, LocalEdit>): FieldEdit[] {
  return Object.values(edits).map(({ path, fields }) => ({ path, fields }));
}

/** The edits as changes made over the combined lists. */
export function editChanges(edits: Record<string, LocalEdit>) {
  return Object.values(edits).map(({ kind, path, before, fields }) => ({
    kind,
    path,
    before,
    after: { ...before, ...fields },
  }));
}
