import { useMutation } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import {
  type CameraOverride,
  deleteOverrideMutation,
  type OverrideRule,
  overrideId,
  saveOverrideMutation,
} from "@/api/cameras";
import { OriginalExif } from "@/components/camera-overrides/original-exif";
import { RuleCard } from "@/components/camera-overrides/rule-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Busy, RemoveEntryButton, SaveNote } from "@/components/entry-buttons";
import { customLenses } from "@/api/lenses";
import { overrideChanges } from "@/lib/camera-overrides";
import { canonicalJson } from "@/lib/combined";
import type { CombinedPhoto } from "@/lib/group-photos";
import { useCombinedData } from "@/stores/combined-data";

interface OverrideEditorProps {
  /** The camera as its photos' EXIF names it. */
  camera: string;
  /** Its saved override; undefined when it has none yet. */
  override?: CameraOverride;
  /** The photos taken with it. */
  photos: CombinedPhoto[];
}

/** A new override's rules: one naming the camera as its EXIF does, to be renamed. */
function startingRules(camera: string, override?: CameraOverride): OverrideRule[] {
  return override?.rules ?? [{ when: null, set: { camera } }];
}

/** Edits one camera's override rules, with the original EXIF of its photos to pick values from. */
export function OverrideEditor({ camera, override, photos }: OverrideEditorProps) {
  const [rules, setRules] = useState(() => startingRules(camera, override));
  const next: CameraOverride = { id: override?.id ?? overrideId(camera), camera, rules };
  const update = (i: number, rule: OverrideRule | null) =>
    setRules(rule ? rules.toSpliced(i, 1, rule) : rules.toSpliced(i, 1));
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{camera}</CardTitle>
          <CardDescription>
            Rules apply in order, each to every photo from this camera or only to those with one
            EXIF value, such as a lens; a later rule&apos;s value for a field wins. Values are
            matched against the photo&apos;s EXIF, not against what another rule wrote.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {rules.map((rule, i) => (
            <RuleCard
              key={i}
              index={i}
              rule={rule}
              photos={photos}
              onChange={(r) => update(i, r)}
            />
          ))}
          <Button
            variant="outline"
            className="self-start"
            onClick={() => setRules([...rules, { when: null, set: {} }])}
          >
            <PlusIcon aria-hidden />
            Add rule
          </Button>
          <Effect next={next} photos={photos} />
          <EditorButtons next={next} saved={override} />
        </CardContent>
      </Card>
      <OriginalExif photos={photos} onUse={(rule) => setRules([...rules, rule])} />
    </div>
  );
}

/** How many of the camera's photos the rules, as written, would change. */
function Effect({ next, photos }: { next: CameraOverride; photos: CombinedPhoto[] }) {
  const lenses = customLenses(useCombinedData().data);
  const changed = photos.filter((p) => Object.keys(overrideChanges([next], lenses, p)).length > 0);
  return (
    <p className="text-muted-foreground text-sm">
      As written, these rules change {changed.length} of {photos.length} photos already saved
      (Update Data applies them once saved); every new photo from this camera gets them.
    </p>
  );
}

/** Why the override can't be saved as written, or "" when it can. */
function problem(next: CameraOverride): string {
  const empty = next.rules.findIndex((rule) => Object.keys(rule.set).length === 0);
  return empty === -1 ? "" : `Rule ${empty + 1} doesn't set any field yet.`;
}

/** Whether next is what saved already has, so there's nothing to save. */
function isUnchanged(next: CameraOverride, saved?: CameraOverride): boolean {
  return saved !== undefined && canonicalJson(next) === canonicalJson(saved);
}

interface ButtonsProps {
  next: CameraOverride;
  saved?: CameraOverride;
}

/** Save, and Remove for a saved override, each saving a change waiting for Commit. */
function EditorButtons({ next, saved }: ButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SaveButton next={next} saved={saved} />
      {saved && <RemoveButton id={saved.id} />}
    </div>
  );
}

function SaveButton({ next, saved }: ButtonsProps) {
  const save = useMutation(saveOverrideMutation);
  const why = problem(next);
  const blocked = isUnchanged(next, saved) || Boolean(why);
  return (
    <>
      <Button disabled={blocked || save.isPending} onClick={() => save.mutate(next)}>
        <Busy busy={save.isPending} />
        <SaveLabel isNew={saved === undefined} />
      </Button>
      <SaveNote error={save.error} why={why} />
    </>
  );
}

function SaveLabel({ isNew }: { isNew: boolean }) {
  return isNew ? "Save override" : "Save changes";
}

function RemoveButton({ id }: { id: string }) {
  const remove = useMutation(deleteOverrideMutation);
  return (
    <RemoveEntryButton
      label="Remove override"
      remove={{ ...remove, mutate: () => remove.mutate(id) }}
    />
  );
}
