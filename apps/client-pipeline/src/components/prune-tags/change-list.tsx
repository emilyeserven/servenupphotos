import { type UseMutationOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { organizeQuery } from "@/api/organize";
import type { PruneTagsPreview } from "@/api/prune-tags";
import { SaveButton, count, invalidatePhotoReads } from "@/components/update-data-shared";
import { toggled } from "@/lib/bulk-tags";

/** The key of one suggested change, such as "merge 0", for the set of unticked ones. */
export function changeKey(kind: string, index: number): string {
  return `${kind} ${index}`;
}

/** Whether the change at index of kind is still ticked, as an array filter. */
export function tickedIn(unticked: ReadonlySet<string>, kind: string) {
  return (_: unknown, index: number) => !unticked.has(changeKey(kind, index));
}

/** "under <id>", or "at the top level" for no parent. */
export function placeName(id: string): ReactNode {
  return id ? (
    <>
      under <code>{id}</code>
    </>
  ) : (
    "at the top level"
  );
}

/** "1 photo gets", "2 photos get". */
function photosGet(n: number): string {
  return `${count(n, "photo")} ${n === 1 ? "gets" : "get"}`;
}

/** What happens to the tags under one that's merged or removed. */
function childrenNote(children: string[], to: string): string {
  if (children.length === 0) return "";
  return ` ${children.join(", ")} ${children.length === 1 ? "moves" : "move"} under ${to}.`;
}

/** One kind of change, listed when the answer suggests any. */
export function Section({ title, children }: { title: string; children: ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium">{title}</h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

/** A muted line under a change, saying what it does. */
export function Note({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground block text-xs">{children}</span>;
}

/** The unticked changes, and how to tick or untick one. */
export interface ChangeToggle {
  unticked: ReadonlySet<string>;
  disabled: boolean;
  onToggle: (key: string) => void;
}

interface ChangeRowProps extends ChangeToggle {
  id: string;
  reason: string;
  children: ReactNode;
}

/** One suggested change with its checkbox and the answer's reason. */
export function ChangeRow({ id, reason, unticked, disabled, onToggle, children }: ChangeRowProps) {
  return (
    <li className="rounded-md border p-3">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={!unticked.has(id)}
          disabled={disabled}
          onChange={() => onToggle(id)}
        />
        <span className="flex flex-col gap-0.5">
          <span>{children}</span>
          {reason && <span className="text-muted-foreground italic">{reason}</span>}
        </span>
      </label>
    </li>
  );
}

/** The answer's changes that can't be made, and why. */
function Skipped({ skipped }: { skipped: PruneTagsPreview["skipped"] }) {
  if (skipped.length === 0) return null;
  return (
    <div className="text-muted-foreground flex flex-col gap-1">
      <p>Left out:</p>
      <ul className="list-disc pl-5">
        {skipped.map(({ change, reason }) => (
          <li key={change}>
            {change}: {reason}.
          </li>
        ))}
      </ul>
    </div>
  );
}

interface PruneSectionsProps {
  preview: Pick<PruneTagsPreview, "merge" | "remove" | "reparent">;
  toggle: ChangeToggle;
}

/** The merges, removals and new parents of a review, each with its checkbox. */
export function PruneSections({ preview, toggle }: PruneSectionsProps) {
  return (
    <>
      <Section title={`Merge (${preview.merge.length})`}>
        {preview.merge.map((m, i) => (
          <ChangeRow key={i} id={changeKey("merge", i)} reason={m.reason} {...toggle}>
            Merge <code>{m.tag}</code> into <code>{m.into}</code>
            <Note>
              {photosGet(m.photos)} {m.into} instead.{childrenNote(m.children, m.into)}
            </Note>
          </ChangeRow>
        ))}
      </Section>
      <Section title={`Remove (${preview.remove.length})`}>
        {preview.remove.map((r, i) => (
          <ChangeRow key={i} id={changeKey("remove", i)} reason={r.reason} {...toggle}>
            Remove <code>{r.tag}</code>
            <Note>
              Taken off {count(r.photos, "photo")}.{childrenNote(r.children, "its parent")}
            </Note>
          </ChangeRow>
        ))}
      </Section>
      <Section title={`New parents (${preview.reparent.length})`}>
        {preview.reparent.map((r, i) => (
          <ChangeRow key={i} id={changeKey("reparent", i)} reason={r.reason} {...toggle}>
            Put <code>{r.tag}</code> {placeName(r.parent)}
            <Note>Now {placeName(r.from)}.</Note>
          </ChangeRow>
        ))}
      </Section>
    </>
  );
}

/** The ticked merges, removals and new parents of preview, as the saves take them. */
export function pruneToSave(
  preview: Pick<PruneTagsPreview, "merge" | "remove" | "reparent">,
  unticked: ReadonlySet<string>,
) {
  return {
    merge: preview.merge
      .filter(tickedIn(unticked, "merge"))
      .map(({ tag, into }) => ({ tag, into })),
    remove: preview.remove.filter(tickedIn(unticked, "remove")).map(({ tag }) => tag),
    reparent: preview.reparent
      .filter(tickedIn(unticked, "reparent"))
      .map(({ tag, parent }) => ({ tag, parent })),
  };
}

/** The changes a review has unticked, and the toggle its rows take while saving is disabled. */
export function useChangeToggle(disabled: boolean): ChangeToggle {
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  return { unticked, disabled, onToggle: (key) => setUnticked(toggled(unticked, key)) };
}

interface ReviewSaveProps<T> {
  skipped: PruneTagsPreview["skipped"];
  /** What the save sends: the ticked changes. */
  save: T;
  /** How many ticked changes the save makes. */
  changes: number;
  disabled: boolean;
  apply: { isPending: boolean; error: Error | null; mutate: (save: T) => void };
}

/** The end of a review: the changes that can't be made, and the button that saves the rest. */
export function ReviewSave<T>({ skipped, save, changes, disabled, apply }: ReviewSaveProps<T>) {
  return (
    <>
      <Skipped skipped={skipped} />
      <SaveButton
        label={`Save ${count(changes, "change")}`}
        disabled={disabled || changes === 0}
        pending={apply.isPending}
        error={apply.error}
        onClick={() => apply.mutate(save)}
      />
    </>
  );
}

/** A review's save, which refreshes the photo reads and the tags once it's saved. */
export function useTagSave<TData, TVariables>(
  options: UseMutationOptions<TData, Error, TVariables>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    onSuccess: () => {
      invalidatePhotoReads(queryClient);
      void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey });
    },
  });
}

/** The notes a review adds to photos' photographer-only notes, each with its checkbox. */
export function NoteSection({
  notes,
  toggle,
}: {
  notes: PruneTagsPreview["notes"];
  toggle: ChangeToggle;
}) {
  return (
    <Section title={`Photographer notes (${notes.length})`}>
      {notes.map((n, i) => (
        <ChangeRow key={i} id={changeKey("notes", i)} reason="" {...toggle}>
          <code>{n.photo}</code>
          <span className="block">{n.note}</span>
        </ChangeRow>
      ))}
    </Section>
  );
}

/** The ticked notes of a review, as the saves take them. */
export function notesToSave(notes: PruneTagsPreview["notes"], unticked: ReadonlySet<string>) {
  return notes.filter(tickedIn(unticked, "notes")).map(({ path, note }) => ({ path, note }));
}
