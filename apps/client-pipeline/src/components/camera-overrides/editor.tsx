import type { UseMutationOptions } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { type OverrideRule, type Overrides } from "@/api/cameras";
import { customLenses } from "@/api/lenses";
import { OriginalExif } from "@/components/camera-overrides/original-exif";
import { RuleCard } from "@/components/camera-overrides/rule-card";
import { EntryEditorButtons } from "@/components/entry-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { overrideChanges, type OverrideSubject } from "@/lib/camera-overrides";
import type { CombinedPhoto } from "@/lib/group-photos";
import { useCombinedData } from "@/stores/combined-data";

/** A camera or lens override file: its ID and its rules, with the camera or lens it's for. */
interface RulesEntry {
  id: string;
  rules: OverrideRule[];
}

interface RulesEditorProps<T extends RulesEntry, R, D> {
  /** Whether the override is for a camera or a lens. */
  subject: OverrideSubject;
  /** The camera or lens as its photos' EXIF names it. */
  name: string;
  /** Its saved override; undefined when it has none yet. */
  saved?: T;
  /** The photos taken with it. */
  photos: CombinedPhoto[];
  /** The override with these rules, as Save would write it. */
  make: (rules: OverrideRule[]) => T;
  /** The override as the only one, to count the photos it changes. */
  alone: (next: T) => Overrides;
  /** Saves it as a change waiting for Commit. */
  save: UseMutationOptions<R, Error, T>;
  /** Removes it by its ID as a change waiting for Commit. */
  remove: UseMutationOptions<D, Error, string>;
}

/** How the rules apply, under the camera's or lens's name. */
const HOW_RULES_APPLY: Record<OverrideSubject, string> = {
  camera:
    "Rules apply in order, each to every photo from this camera or only to those with one EXIF value, such as a lens; a later rule's value for a field wins. They come after the lens overrides, so they win over them.",
  lens: "Rules apply in order, each to every photo taken with this lens, whatever the camera, or only to those with one EXIF value, such as a camera; a later rule's value for a field wins. A camera override's rules come after them and win where both set a field.",
};

/** The photos a new photo with the camera or lens is, for the note under the rules. */
const NEW_PHOTOS: Record<OverrideSubject, string> = {
  camera: "every new photo from this camera",
  lens: "every new photo taken with this lens",
};

/**
 * Edits one camera's or lens's override rules, with the original EXIF of its photos to pick values
 * from. Values are matched against the photo's EXIF, not against what another rule wrote. A new
 * override starts with a rule naming the camera or lens as its EXIF does, to be renamed.
 */
export function RulesEditor<T extends RulesEntry, R, D>(props: RulesEditorProps<T, R, D>) {
  const { subject, name, photos } = props;
  const [rules, setRules] = useState(
    () => props.saved?.rules ?? [{ when: null, set: { [subject]: name } }],
  );
  const next = props.make(rules);
  const update = (i: number, rule: OverrideRule | null) =>
    setRules(rule ? rules.toSpliced(i, 1, rule) : rules.toSpliced(i, 1));
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{name}</CardTitle>
          <CardDescription>
            {HOW_RULES_APPLY[subject]} Values are matched against the photo&apos;s EXIF, not against
            what another rule wrote.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {rules.map((rule, i) => (
            <RuleCard
              key={i}
              index={i}
              rule={rule}
              photos={photos}
              subject={subject}
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
          <Effect overrides={props.alone(next)} subject={subject} photos={photos} />
          <EntryEditorButtons
            next={next}
            saved={props.saved}
            save={props.save}
            remove={props.remove}
            whyNot={rulesProblem}
            saveLabel="Save override"
            removeLabel="Remove override"
          />
        </CardContent>
      </Card>
      <OriginalExif
        photos={photos}
        subject={subject}
        onUse={(rule) => setRules([...rules, rule])}
      />
    </div>
  );
}

interface EffectProps {
  overrides: Overrides;
  subject: OverrideSubject;
  photos: CombinedPhoto[];
}

/** How many of the camera's or lens's photos the rules, as written, would change. */
function Effect({ overrides, subject, photos }: EffectProps) {
  const lenses = customLenses(useCombinedData().data);
  const changed = photos.filter((p) => Object.keys(overrideChanges(overrides, lenses, p)).length);
  return (
    <p className="text-muted-foreground text-sm">
      As written, these rules change {changed.length} of {photos.length} photos already saved
      (Update Data applies them once saved); {NEW_PHOTOS[subject]} gets them.
    </p>
  );
}

/** Why an override with these rules can't be saved as written, or "" when it can. */
function rulesProblem({ rules }: { rules: OverrideRule[] }): string {
  const empty = rules.findIndex((rule) => Object.keys(rule.set).length === 0);
  return empty === -1 ? "" : `Rule ${empty + 1} doesn't set any field yet.`;
}
