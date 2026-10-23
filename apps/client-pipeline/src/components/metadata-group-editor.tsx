import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteMetaGroupMutation,
  type MetaFieldInfo,
  type MetaGroup,
  metaGroupId,
  type MetaRange,
  type MetaValue,
  saveMetaGroupMutation,
} from "@/api/metainfo";
import { FieldLabel } from "@/components/field-label";
import { MetaParentField } from "@/components/metadata-parent-field";
import { MetaRangePicker, rangeStops } from "@/components/metadata-range-picker";
import { MetaUncovered } from "@/components/metadata-uncovered";
import { MetaValuePicker } from "@/components/metadata-value-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Busy, RemoveEntryButton } from "@/components/entry-buttons";
import { Textarea } from "@/components/ui/textarea";
import { canonicalJson } from "@/lib/combined";
import { uncoveredValues } from "@/lib/meta-groups";
import type { MetaValueCount } from "@/lib/meta-values";

interface MetaGroupEditorProps {
  info: MetaFieldInfo;
  /** The group to edit; undefined for a new one. */
  group?: MetaGroup;
  /** Every value of the field, to choose from. */
  values: MetaValueCount[];
  /** The field's groups, to keep two from sharing a name and to put this one in. */
  groups: MetaGroup[];
  /** After a save, with the group's ID. */
  onSaved: (id: string) => void;
  onRemoved: () => void;
}

/**
 * Where the group goes among its siblings: its saved place while it stays in the same parent, else
 * after the groups already in the new one.
 */
function orderFor(group: MetaGroup | undefined, parent: string, groups: MetaGroup[]) {
  if (group && (group.parent ?? "") === parent) return group.order;
  const siblings = groups.filter((g) => (g.parent ?? "") === parent && g.id !== group?.id);
  return Math.max(-1, ...siblings.map((g) => g.order ?? 0)) + 1;
}

/** The group as typed, as it would be saved: a range for a ranged field, else its values. */
function drafted(
  info: MetaFieldInfo,
  group: MetaGroup | undefined,
  draft: Draft,
  groups: MetaGroup[],
): MetaGroup {
  const name = draft.name.trim();
  const base = {
    id: group?.id ?? metaGroupId(info.field, name),
    name,
    description: draft.description.trim(),
    field: info.field,
    parent: draft.parent,
    order: orderFor(group, draft.parent, groups),
  };
  return info.ranged
    ? { ...base, values: [], range: draft.range }
    : { ...base, values: draft.values };
}

interface Draft {
  name: string;
  description: string;
  parent: string;
  values: MetaValue[];
  range: MetaRange;
}

/** A new group's range: every value the photos have, or 0 to 0 when none has one. */
function wholeRange(values: MetaValueCount[]): MetaRange {
  const stops = rangeStops(values);
  return { min: stops[0] ?? 0, max: stops.at(-1) ?? 0 };
}

function startingDraft(group: MetaGroup | undefined, values: MetaValueCount[]): Draft {
  if (!group)
    return { name: "", description: "", parent: "", values: [], range: wholeRange(values) };
  return { ...group, parent: group.parent ?? "", range: group.range ?? wholeRange(values) };
}

/** Why the range can't be saved, or "". */
function rangeProblem(range: MetaRange | undefined): string {
  if (!range) return "";
  return isOpenBothWays(range) ? "Give the range at least one end." : backwards(range);
}

function isOpenBothWays({ min, max }: MetaRange): boolean {
  return min === undefined && max === undefined;
}

/** "The range ends before it starts." when it does, or "". */
function backwards({ min = -Infinity, max = Infinity }: MetaRange): string {
  return min > max ? "The range ends before it starts." : "";
}

/** Why the group can't be saved as typed, or "" when it can. */
function problem(next: MetaGroup, groups: MetaGroup[]): string {
  if (!next.name) return "Give the group a name.";
  const taken = groups.find(
    (g) => g.id !== next.id && g.name.toLowerCase() === next.name.toLowerCase(),
  );
  return taken ? `There's already a group named “${taken.name}”.` : rangeProblem(next.range);
}

/** The ID of the group a save wrote, from its file name. */
function savedId(result: { path: string }): string {
  return result.path.replace(/^.*\//, "").replace(/\.json$/, "");
}

/** Edits one metadata group's name, description and values, and saves or removes it. */
export function MetaGroupEditor(props: MetaGroupEditorProps) {
  const { info, group, values } = props;
  const [draft, setDraft] = useState(() => startingDraft(group, values));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{group ? group.name : `New ${info.one} group`}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TextFields info={info} draft={draft} onChange={setDraft} />
        <MetaParentField
          info={info}
          groups={props.groups}
          groupId={group?.id}
          parent={draft.parent}
          onChange={(parent) => setDraft({ ...draft, parent })}
        />
        <ValuesField {...props} draft={draft} onChange={setDraft} />
        <SubgroupGaps {...props} />
        <EditorButtons {...props} next={drafted(info, group, draft, props.groups)} />
      </CardContent>
    </Card>
  );
}

/** A range for a focal length, aperture, exposure or ISO group, else a checkbox per value. */
function ValuesField({
  info,
  group,
  values,
  groups,
  draft,
  onChange,
}: MetaGroupEditorProps & TextFieldsProps) {
  if (info.ranged) {
    return (
      <MetaRangePicker
        info={info}
        values={values}
        range={draft.range}
        onChange={(range) => onChange({ ...draft, range })}
      />
    );
  }
  return (
    <MetaValuePicker
      info={info}
      values={values}
      groups={groups}
      groupId={group?.id}
      parent={draft.parent}
      chosen={draft.values}
      onChange={(chosen) => onChange({ ...draft, values: chosen })}
    />
  );
}

/** For a saved group with subgroups, the values in it that none of them has. */
function SubgroupGaps({ info, group, values, groups }: MetaGroupEditorProps) {
  if (!group || !groups.some((g) => g.parent === group.id)) return null;
  return (
    <MetaUncovered
      info={info}
      values={uncoveredValues(values, groups, group)}
      outside="its subgroups"
      inside="one of its subgroups"
    />
  );
}

interface TextFieldsProps {
  info: MetaFieldInfo;
  draft: Draft;
  onChange: (draft: Draft) => void;
}

function TextFields({ info, draft, onChange }: TextFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <FieldLabel
          htmlFor="meta-group-name"
          help={`What the group is, such as “${info.example}”.`}
        >
          Name
        </FieldLabel>
        <Input
          id="meta-group-name"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel
          htmlFor="meta-group-description"
          help="A note on what's in the group and why. Optional."
        >
          Description
        </FieldLabel>
        <Textarea
          id="meta-group-description"
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </div>
    </>
  );
}

/** Whether next is what group already has, so there's nothing to save. */
function isUnchanged(next: MetaGroup, group: MetaGroup | undefined): boolean {
  return group !== undefined && canonicalJson(next) === canonicalJson(group);
}

type ButtonsProps = MetaGroupEditorProps & { next: MetaGroup };

/** Save, and Remove for a saved group, each saving a change waiting for Commit. */
function EditorButtons(props: ButtonsProps) {
  const { group, onRemoved } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SaveButton {...props} />
      {group && <RemoveButton id={group.id} onRemoved={onRemoved} />}
    </div>
  );
}

function SaveButton({ group, groups, next, onSaved }: ButtonsProps) {
  const save = useMutation({ ...saveMetaGroupMutation, onSuccess: (r) => onSaved(savedId(r)) });
  const why = problem(next, groups);
  const blocked = Boolean(why) || isUnchanged(next, group);
  return (
    <>
      <Button disabled={blocked || save.isPending} onClick={() => save.mutate(next)}>
        <Busy busy={save.isPending} />
        <SaveLabel isNew={group === undefined} />
      </Button>
      <SaveNote error={save.error} why={next.name ? why : ""} />
    </>
  );
}

function SaveLabel({ isNew }: { isNew: boolean }) {
  return isNew ? "Save group" : "Save changes";
}

/** Why the last save failed, or else why the group can't be saved yet. */
function SaveNote({ error, why }: { error: Error | null; why: string }) {
  return error ? <Note text={error.message} error /> : <Note text={why} error={false} />;
}

function RemoveButton({ id, onRemoved }: { id: string; onRemoved: () => void }) {
  const remove = useMutation({ ...deleteMetaGroupMutation, onSuccess: onRemoved });
  return (
    <RemoveEntryButton
      label="Remove group"
      remove={{ ...remove, mutate: () => remove.mutate(id) }}
    />
  );
}

/** Why the group can't be saved, or why a save failed, beside the buttons. */
function Note({ text, error }: { text: string; error: boolean }) {
  if (!text) return null;
  return (
    <span className={error ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>
      {text}
    </span>
  );
}
