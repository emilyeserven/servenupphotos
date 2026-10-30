import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { organizeQuery } from "@/api/organize";
import { type PruneTags, type PruneTagsPreview, applyPruneTagsMutation } from "@/api/prune-tags";
import {
  CommitSuccess,
  SaveButton,
  count,
  invalidatePhotoReads,
} from "@/components/update-data-shared";
import { toggled } from "@/lib/bulk-tags";

/** The key of one suggested change, such as "merge 0", for the set of unticked ones. */
function changeKey(kind: keyof PruneTags, index: number): string {
  return `${kind} ${index}`;
}

/** The ticked changes of preview, as the save takes them. */
function pruneToSave(preview: PruneTagsPreview, unticked: ReadonlySet<string>): PruneTags {
  const ticked = (kind: keyof PruneTags) => (_: unknown, i: number) =>
    !unticked.has(changeKey(kind, i));
  return {
    merge: preview.merge.filter(ticked("merge")).map(({ tag, into }) => ({ tag, into })),
    remove: preview.remove.filter(ticked("remove")).map(({ tag }) => tag),
    reparent: preview.reparent
      .filter(ticked("reparent"))
      .map(({ tag, parent }) => ({ tag, parent })),
  };
}

/** How many changes save makes. */
function changeCount(save: PruneTags): number {
  return save.merge.length + save.remove.length + save.reparent.length;
}

/** "under <id>", or "at the top level" for no parent. */
function placeName(id: string): ReactNode {
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

/**
 * The review of the LLM's answer: the tags to merge, remove and put under others, each of which
 * can be unticked, the changes that can't be made and why, then a button that saves the rest.
 */
export function PruneTagReview({ preview }: { preview: PruneTagsPreview }) {
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const apply = useApplyPruneTags();
  const save = pruneToSave(preview, unticked);
  const toggle = {
    unticked,
    disabled: apply.isPending || apply.isSuccess,
    onToggle: (key: string) => setUnticked(toggled(unticked, key)),
  };
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <Section title={`Merge (${preview.merge.length})`}>
        {preview.merge.map((m, i) => (
          <ChangeRow
            key={changeKey("merge", i)}
            id={changeKey("merge", i)}
            reason={m.reason}
            {...toggle}
          >
            Merge <code>{m.tag}</code> into <code>{m.into}</code>
            <Note>
              {photosGet(m.photos)} {m.into} instead.{childrenNote(m.children, m.into)}
            </Note>
          </ChangeRow>
        ))}
      </Section>
      <Section title={`Remove (${preview.remove.length})`}>
        {preview.remove.map((r, i) => (
          <ChangeRow
            key={changeKey("remove", i)}
            id={changeKey("remove", i)}
            reason={r.reason}
            {...toggle}
          >
            Remove <code>{r.tag}</code>
            <Note>
              Taken off {count(r.photos, "photo")}.{childrenNote(r.children, "its parent")}
            </Note>
          </ChangeRow>
        ))}
      </Section>
      <Section title={`New parents (${preview.reparent.length})`}>
        {preview.reparent.map((r, i) => (
          <ChangeRow
            key={changeKey("reparent", i)}
            id={changeKey("reparent", i)}
            reason={r.reason}
            {...toggle}
          >
            Put <code>{r.tag}</code> {placeName(r.parent)}
            <Note>Now {placeName(r.from)}.</Note>
          </ChangeRow>
        ))}
      </Section>
      <Skipped skipped={preview.skipped} />
      <SaveButton
        label={`Save ${count(changeCount(save), "change")}`}
        disabled={toggle.disabled || changeCount(save) === 0}
        pending={apply.isPending}
        error={apply.error}
        onClick={() => apply.mutate(save)}
      />
      {apply.data && (
        <CommitSuccess result={apply.data}>
          Deleted {count(apply.data.deleted, "tag")}, gave {count(apply.data.reparented, "tag")} a
          new parent and changed the tags of {count(apply.data.photos, "photo")}
        </CommitSuccess>
      )}
    </div>
  );
}

/** Saves the reviewed changes, then refreshes the photo reads and the tags. */
function useApplyPruneTags() {
  const queryClient = useQueryClient();
  return useMutation({
    ...applyPruneTagsMutation,
    onSuccess: () => {
      invalidatePhotoReads(queryClient);
      void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey });
    },
  });
}

/** One kind of change, listed when the answer suggests any. */
function Section({ title, children }: { title: string; children: ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium">{title}</h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

/** A muted line under a change, saying what it does. */
function Note({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground block text-xs">{children}</span>;
}

interface ChangeRowProps {
  id: string;
  reason: string;
  unticked: ReadonlySet<string>;
  disabled: boolean;
  onToggle: (key: string) => void;
  children: ReactNode;
}

/** One suggested change with its checkbox and the answer's reason. */
function ChangeRow({ id, reason, unticked, disabled, onToggle, children }: ChangeRowProps) {
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
