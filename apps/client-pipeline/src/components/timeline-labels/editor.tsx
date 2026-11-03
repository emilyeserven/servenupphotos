import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteLabelMutation,
  labelId,
  overlappingLabel,
  saveLabelMutation,
  type TimelineLabel,
} from "@/api/timeline-labels";
import { Busy, RemoveEntryButton, SaveNote } from "@/components/entry-buttons";
import { dayRange } from "@/components/timeline-labels/day-range";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canonicalJson } from "@/lib/combined";

/** The label as typed. */
type LabelDraft = Omit<TimelineLabel, "id">;

const EMPTY_LABEL: LabelDraft = { name: "", start: "", end: "" };

/** The label the draft saves, keeping a saved label's ID. */
function labelOf(draft: LabelDraft, saved?: TimelineLabel): TimelineLabel {
  const name = draft.name.trim();
  return { id: saved?.id ?? labelId(name, draft.start), name, ...days(draft) };
}

/** The draft's first and last days, with the last day the first when it's left empty. */
function days({ start, end }: LabelDraft): Pick<TimelineLabel, "start" | "end"> {
  return { start, end: end || start };
}

interface LabelEditorProps {
  /** The saved label; undefined for a new one. */
  label?: TimelineLabel;
  /** Every saved label, to warn about days another already covers. */
  labels: TimelineLabel[];
  /** How many saved photos were taken on the days typed, from the first to the last. */
  countPhotos: (start: string, end: string) => number;
  /** With the saved label's ID. */
  onSaved: (id: string) => void;
}

/** Edits one timeline label, or a new one. */
export function LabelEditor({ label, labels, countPhotos, onSaved }: LabelEditorProps) {
  const [draft, setDraft] = useState<LabelDraft>(() => label ?? EMPTY_LABEL);
  const set = (part: Partial<LabelDraft>) => setDraft({ ...draft, ...part });
  const next = labelOf(draft, label);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label?.name ?? "New timeline label"}</CardTitle>
        <CardDescription>
          <Covers next={next} countPhotos={countPhotos} />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field label="Name, as the Timeline shows it">
          <Input
            value={draft.name}
            placeholder="Japan"
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First day">
            <Input
              type="date"
              value={draft.start}
              onChange={(e) => set({ start: e.target.value })}
            />
          </Field>
          <Field label="Last day, included">
            <Input
              type="date"
              value={draft.end}
              min={draft.start}
              onChange={(e) => set({ end: e.target.value })}
            />
          </Field>
        </div>
        <EditorButtons next={next} saved={label} labels={labels} onSaved={onSaved} />
      </CardContent>
    </Card>
  );
}

/** The days the label covers and how many photos were taken on them, once both are typed. */
function Covers({
  next,
  countPhotos,
}: Pick<LabelEditorProps, "countPhotos"> & { next: TimelineLabel }) {
  if (!next.start) return <>Pick the days it covers. Each day can have one label.</>;
  const count = countPhotos(next.start, next.end);
  return (
    <>
      {dayRange(next.start, next.end)}: {count} saved {count === 1 ? "photo" : "photos"} taken then.
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

interface ButtonsProps {
  next: TimelineLabel;
  saved?: TimelineLabel;
  labels: TimelineLabel[];
  onSaved: (id: string) => void;
}

/** Save, and Remove for a saved label, each saving a change waiting for Commit. */
function EditorButtons({ next, saved, labels, onSaved }: ButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SaveButton next={next} saved={saved} labels={labels} onSaved={onSaved} />
      {saved && <RemoveButton id={saved.id} />}
    </div>
  );
}

/** Why the label can't be saved yet, or "" when it can. */
function whyNot(next: TimelineLabel, labels: TimelineLabel[]): string {
  if (next.name === "" || next.start === "") return "Give it a name and a first day.";
  if (next.end < next.start) return "The last day is before the first.";
  return overlapNote(overlappingLabel(labels, next));
}

/** What another label that covers some of the same days covers, or "" with none. */
function overlapNote(other: TimelineLabel | undefined): string {
  return other ? `“${other.name}” already covers ${dayRange(other.start, other.end)}.` : "";
}

/** Whether there's nothing to save: the label can't be saved yet, or is what's saved already. */
function nothingToSave(why: string, next: TimelineLabel, saved?: TimelineLabel): boolean {
  return why !== "" || canonicalJson(next) === canonicalJson(saved ?? null);
}

function SaveButton({ next, saved, labels, onSaved }: ButtonsProps) {
  const save = useMutation(saveLabelMutation);
  const why = whyNot(next, labels);
  return (
    <>
      <Button
        disabled={nothingToSave(why, next, saved) || save.isPending}
        onClick={() => save.mutate(next, { onSuccess: () => onSaved(next.id) })}
      >
        <Busy busy={save.isPending} />
        {saved ? "Save changes" : "Save label"}
      </Button>
      <SaveNote error={save.error} why={why} />
    </>
  );
}

function RemoveButton({ id }: { id: string }) {
  const remove = useMutation(deleteLabelMutation);
  return (
    <RemoveEntryButton
      label="Remove label"
      remove={{ ...remove, mutate: () => remove.mutate(id) }}
    />
  );
}
