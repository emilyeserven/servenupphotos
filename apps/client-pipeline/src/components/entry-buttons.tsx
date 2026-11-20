import { ErrorNote } from "@/components/error-note";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { canonicalJson } from "@/lib/combined";

/** A spinner while busy, inside a button. */
export function Busy({ busy }: { busy: boolean }) {
  return busy ? <Spinner /> : null;
}

/** Why the last save failed, or else why the file can't be saved yet, beside the buttons. */
export function SaveNote({ error, why }: { error: Error | null; why: string }) {
  if (error) return <ErrorNote error={error} />;
  return why ? <span className="text-muted-foreground text-sm">{why}</span> : null;
}

interface RemoveEntryButtonProps {
  /** Its text, such as "Remove group". */
  label: string;
  remove: { isPending: boolean; error: Error | null; mutate: () => void };
  /** Why the file can't be removed yet, such as a group that still has presets in it, or "". */
  whyKeep?: string;
}

/** Removes a saved file, as a change waiting for Commit, with why it failed when it does. */
export function RemoveEntryButton({ label, remove, whyKeep = "" }: RemoveEntryButtonProps) {
  return (
    <>
      <Button
        variant="outline"
        disabled={whyKeep !== "" || remove.isPending}
        title={whyKeep || undefined}
        onClick={() => remove.mutate()}
      >
        <Busy busy={remove.isPending} />
        {label}
      </Button>
      <SaveNote error={remove.error} why={whyKeep} />
    </>
  );
}

/** An entry an editor saves as one JSON file, named by its ID. */
interface Entry {
  id: string;
}

/** What an entry editor's Save and Remove buttons need. */
export interface EntryEditorButtonsProps<T extends Entry, R, D> {
  /** The entry as typed now, the way Save would write it. */
  next: T;
  /** Its saved copy; undefined for a new entry, which gets no Remove button. */
  saved?: T;
  /** Saves next as a change waiting for Commit, such as `saveLensMutation`. */
  save: UseMutationOptions<R, Error, T>;
  /** Removes the saved file by its ID as a change waiting for Commit, such as `deleteLensMutation`. */
  remove: UseMutationOptions<D, Error, string>;
  /** Why next can't be saved yet, such as "Give it a name.", or "" when it can. Shown beside Save. */
  whyNot?: (next: T) => string;
  /** What Save says for a new entry, such as "Save lens". */
  saveLabel: string;
  /** What Save says for a saved one; "Save changes" unless given. */
  changesLabel?: string;
  /** What Remove says, such as "Remove lens". */
  removeLabel: string;
  /** Why the saved entry can't be removed yet, or "". */
  whyKeep?: string;
  /** Called with the entry's ID once it's saved. */
  onSaved?: (id: string) => void;
  /** Called once the saved entry is removed. */
  onRemoved?: () => void;
}

/**
 * Every entry editor's Save button, and Remove for a saved entry, each saving a change waiting
 * for Commit. Save is held back while whyNot gives a reason, which shows beside it, or while
 * next is what's saved already.
 */
export function EntryEditorButtons<T extends Entry, R, D>(props: EntryEditorButtonsProps<T, R, D>) {
  const { saved, removeLabel, whyKeep, onRemoved } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <EntrySaveButton {...props} />
      {saved && (
        <EntryRemoveButton
          id={saved.id}
          label={removeLabel}
          whyKeep={whyKeep}
          remove={props.remove}
          onRemoved={onRemoved}
        />
      )}
    </div>
  );
}

function EntrySaveButton<T extends Entry, R, D>(props: EntryEditorButtonsProps<T, R, D>) {
  const { next, onSaved } = props;
  const save = useMutation({ ...props.save, onSuccess: (_, entry) => onSaved?.(entry.id) });
  const why = whyOf(props);
  return (
    <>
      <Button disabled={isBlocked(why, props) || save.isPending} onClick={() => save.mutate(next)}>
        <Busy busy={save.isPending} />
        {saveLabelOf(props)}
      </Button>
      <SaveNote error={save.error} why={why} />
    </>
  );
}

/** Why next can't be saved yet, or "" when it can. */
function whyOf<T extends Entry>({ next, whyNot }: { next: T; whyNot?: (next: T) => string }) {
  return whyNot ? whyNot(next) : "";
}

/** Whether Save is held back: there's a reason, or next is what's saved already. */
function isBlocked<T extends Entry>(why: string, { next, saved }: { next: T; saved?: T }): boolean {
  return why !== "" || canonicalJson(next) === canonicalJson(saved ?? null);
}

/** What Save says: the new entry's label, or "Save changes" (or changesLabel) for a saved one. */
function saveLabelOf({ saved, saveLabel, changesLabel = "Save changes" }: SaveLabels): string {
  return saved ? changesLabel : saveLabel;
}

/** The parts of the props that pick what Save says. */
interface SaveLabels {
  saved?: unknown;
  saveLabel: string;
  changesLabel?: string;
}

interface EntryRemoveButtonProps<D> {
  id: string;
  label: string;
  whyKeep?: string;
  remove: UseMutationOptions<D, Error, string>;
  onRemoved?: () => void;
}

function EntryRemoveButton<D>({
  id,
  label,
  whyKeep,
  remove,
  onRemoved,
}: EntryRemoveButtonProps<D>) {
  const mutation = useMutation({ ...remove, onSuccess: () => onRemoved?.() });
  return (
    <RemoveEntryButton
      label={label}
      whyKeep={whyKeep}
      remove={{
        isPending: mutation.isPending,
        error: mutation.error,
        mutate: () => mutation.mutate(id),
      }}
    />
  );
}
