import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { deletePresetMutation, savePresetMutation } from "@/api/graph-presets";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canonicalJson } from "@/lib/combined";
import type { GraphPresetFile } from "@portfolio/lib/graph-presets";

/** A setting in a preset or group editor: its name over its control. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

interface NameOrderProps {
  name: string;
  order: number;
  /** An example name, such as "Aperture". */
  placeholder: string;
  onChange: (part: { name?: string; order?: number }) => void;
}

/** The name the Graph page shows, and where it sits among the others. */
export function NameAndOrder({ name, order, placeholder, onChange }: NameOrderProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
      <Field label="Name, as the Graph page shows it">
        <Input
          value={name}
          placeholder={placeholder}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <Field label="Order">
        <Input
          type="number"
          min={0}
          value={order}
          onChange={(e) => onChange({ order: Math.max(0, Math.round(Number(e.target.value))) })}
        />
      </Field>
    </div>
  );
}

interface EditorButtonsProps {
  next: GraphPresetFile;
  /** The saved file; undefined for a new one. */
  saved?: GraphPresetFile;
  /** Why it can't be saved yet, or "". */
  why: string;
  /** Why a saved one can't be removed, or "". */
  whyKeep?: string;
  onSaved: (id: string) => void;
}

/** Whether there's nothing to save: it can't be saved yet, or is what's saved already. */
function nothingToSave({ next, saved, why }: EditorButtonsProps): boolean {
  return why !== "" || canonicalJson(next) === canonicalJson(saved ?? null);
}

/** Save, and Remove for a saved preset or group, each saving a change waiting for Commit. */
export function EditorButtons(props: EditorButtonsProps) {
  const { next, saved, whyKeep = "" } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SaveButton {...props} />
      {saved && <RemoveButton id={saved.id} label={`Remove ${next.kind}`} whyKeep={whyKeep} />}
    </div>
  );
}

/** Saves the preset or group, with why it can't be saved yet or why saving failed beside it. */
function SaveButton(props: EditorButtonsProps) {
  const save = useMutation(savePresetMutation);
  const { next, saved, why, onSaved } = props;
  return (
    <>
      <Button
        disabled={nothingToSave(props) || save.isPending}
        onClick={() => save.mutate(next, { onSuccess: () => onSaved(next.id) })}
      >
        <Busy busy={save.isPending} />
        {saved ? "Save changes" : `Save ${next.kind}`}
      </Button>
      <SaveNote error={save.error} why={why} />
    </>
  );
}

function RemoveButton({ id, label, whyKeep }: { id: string; label: string; whyKeep: string }) {
  const remove = useMutation(deletePresetMutation);
  return (
    <>
      <Button
        variant="outline"
        disabled={whyKeep !== "" || remove.isPending}
        title={whyKeep || undefined}
        onClick={() => remove.mutate(id)}
      >
        <Busy busy={remove.isPending} />
        {label}
      </Button>
      <SaveNote error={remove.error} why={whyKeep} />
    </>
  );
}
