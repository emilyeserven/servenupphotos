/** A photo's mark for editing it again, as the photo JSON's `reEdit` saves it. */
export interface ReEdit {
  /** Why it needs editing again, such as "Too warm"; empty when none was given. */
  reason: string;
  /** The day it was marked, as YYYY-MM-DD. */
  date: string;
}

/** The re-edit mark being edited on the Photo page. */
export interface ReEditDraft {
  marked: boolean;
  reason: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The re-edit mark saved in a photo's JSON, or null when it isn't marked. */
export function savedReEdit(data: unknown): ReEdit | null {
  const reEdit = isObject(data) ? data.reEdit : null;
  if (!isObject(reEdit)) return null;
  return { reason: text(reEdit.reason), date: text(reEdit.date) };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The re-edit mark saved in a photo's JSON, to start editing from. */
export function savedReEditDraft(data: unknown): ReEditDraft {
  const saved = savedReEdit(data);
  return { marked: saved !== null, reason: saved?.reason ?? "" };
}

/** Whether draft marks the photo differently from its JSON, or gives another reason. */
export function reEditChanged(data: unknown, draft: ReEditDraft): boolean {
  const saved = savedReEditDraft(data);
  return saved.marked !== draft.marked || (draft.marked && saved.reason !== draft.reason.trim());
}

/** Today, as YYYY-MM-DD in the local time zone. */
function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** data with draft saved as its `reEdit`, keeping the day it was first marked. */
export function withReEdit<T extends object>(data: T, draft: ReEditDraft): T {
  if (!draft.marked) return { ...data, reEdit: null };
  const date = savedReEdit(data)?.date || today();
  return { ...data, reEdit: { reason: draft.reason.trim(), date } };
}

/** A photo marked for re-editing, with its mark, as the Re-edit page lists it. */
export interface MarkedPhoto<T> {
  /** The photo as the list was given it. */
  entry: T;
  /** Its saved re-edit mark. */
  reEdit: ReEdit;
}

/**
 * The photos marked for re-editing, most recently marked first (undated marks last, then by key),
 * reading each one's data with `dataOf`.
 */
export function markedPhotos<T extends { key: string }>(
  entries: readonly T[],
  dataOf: (entry: T) => unknown,
): MarkedPhoto<T>[] {
  return entries
    .map((entry) => ({ entry, reEdit: savedReEdit(dataOf(entry)) }))
    .filter((item): item is MarkedPhoto<T> => item.reEdit !== null)
    .toSorted(
      (a, b) =>
        b.reEdit.date.localeCompare(a.reEdit.date) ||
        a.entry.key.localeCompare(b.entry.key, undefined, { numeric: true }),
    );
}
