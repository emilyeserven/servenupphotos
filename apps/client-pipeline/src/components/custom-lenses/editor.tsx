import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { type CustomLens, deleteLensMutation, lensId, saveLensMutation } from "@/api/lenses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Busy, RemoveEntryButton, SaveNote } from "@/components/entry-buttons";
import { Textarea } from "@/components/ui/textarea";
import { canonicalJson } from "@/lib/combined";

/** The lens as typed, its numbers still text. */
interface LensDraft {
  name: string;
  description: string;
  focalLength: string;
  aperture: string;
  manualAperture: boolean;
}

const EMPTY_LENS: CustomLens = {
  id: "",
  name: "",
  description: "",
  focalLength: null,
  aperture: null,
  manualAperture: false,
};

/** A number as typed, "" for none. */
function textOf(n: number | null): string {
  return n === null ? "" : String(n);
}

function draftOf(lens: CustomLens = EMPTY_LENS): LensDraft {
  const { name, description, manualAperture } = lens;
  return {
    name,
    description,
    focalLength: textOf(lens.focalLength),
    aperture: textOf(lens.aperture),
    manualAperture,
  };
}

/** A typed number, or null when nothing was typed. */
function numberOf(text: string): number | null {
  return text.trim() === "" ? null : Number(text);
}

/** The lens the draft saves, keeping a saved lens's ID; a manual aperture has no f-number. */
function lensOf(draft: LensDraft, saved?: CustomLens): CustomLens {
  return {
    id: saved?.id ?? lensId(draft.name),
    name: draft.name.trim(),
    description: draft.description.trim(),
    focalLength: numberOf(draft.focalLength),
    aperture: draft.manualAperture ? null : numberOf(draft.aperture),
    manualAperture: draft.manualAperture,
  };
}

interface LensEditorProps {
  /** The saved lens; undefined for a new one. */
  lens?: CustomLens;
  /** How many photos have the lens. */
  photos: number;
  /** With the saved lens's ID. */
  onSaved: (id: string) => void;
}

/** Edits one custom lens, or a new one. */
export function LensEditor({ lens, photos, onSaved }: LensEditorProps) {
  const [draft, setDraft] = useState(() => draftOf(lens));
  const set = (part: Partial<LensDraft>) => setDraft({ ...draft, ...part });
  const next = lensOf(draft, lens);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{lens?.name ?? "New custom lens"}</CardTitle>
        <CardDescription>
          <Usage lens={lens} photos={photos} />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field label="Name, written as the photo's lens">
          <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Focal length (mm), empty keeps the photo's">
            <NumberInput
              value={draft.focalLength}
              onChange={(focalLength) => set({ focalLength })}
            />
          </Field>
          <Field label="Aperture (f-number), empty keeps the photo's">
            <NumberInput
              value={draft.manualAperture ? "" : draft.aperture}
              disabled={draft.manualAperture}
              onChange={(aperture) => set({ aperture })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={draft.manualAperture}
            onChange={(e) => set({ manualAperture: e.target.checked })}
          />
          Manual/unknown aperture: photos with the lens get no aperture, and the portfolio says so
        </label>
        <EditorButtons next={next} saved={lens} onSaved={onSaved} />
      </CardContent>
    </Card>
  );
}

/** How many photos have the lens, and where they get it. */
function Usage({ lens, photos }: { lens?: CustomLens; photos: number }) {
  if (!lens) return <>Pick it on the Photo page once it&apos;s saved.</>;
  return (
    <>
      {photos} saved {photos === 1 ? "photo has" : "photos have"} it. Changes reach them through
      Update Data&apos;s camera overrides, or the Photo page.
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

interface NumberInputProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function NumberInput({ value, disabled, onChange }: NumberInputProps) {
  return (
    <Input
      type="number"
      step="any"
      min="0"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

interface ButtonsProps {
  next: CustomLens;
  saved?: CustomLens;
  onSaved: (id: string) => void;
}

/** Save, and Remove for a saved lens, each saving a change waiting for Commit. */
function EditorButtons({ next, saved, onSaved }: ButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SaveButton next={next} saved={saved} onSaved={onSaved} />
      {saved && <RemoveButton id={saved.id} />}
    </div>
  );
}

/** Whether next is what saved already has, or has no name, so there's nothing to save. */
function cantSave(next: CustomLens, saved?: CustomLens): boolean {
  return next.name === "" || canonicalJson(next) === canonicalJson(saved ?? null);
}

function SaveButton({ next, saved, onSaved }: ButtonsProps) {
  const save = useMutation(saveLensMutation);
  return (
    <>
      <Button
        disabled={cantSave(next, saved) || save.isPending}
        onClick={() => save.mutate(next, { onSuccess: () => onSaved(next.id) })}
      >
        <Busy busy={save.isPending} />
        {saved ? "Save changes" : "Save lens"}
      </Button>
      <SaveNote error={save.error} why="" />
    </>
  );
}

function RemoveButton({ id }: { id: string }) {
  const remove = useMutation(deleteLensMutation);
  return (
    <RemoveEntryButton
      label="Remove lens"
      remove={{ ...remove, mutate: () => remove.mutate(id) }}
    />
  );
}
