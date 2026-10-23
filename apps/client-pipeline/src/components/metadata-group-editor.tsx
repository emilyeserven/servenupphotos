import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteMetaGroupMutation,
  type MetaFieldInfo,
  type MetaGroup,
  metaGroupId,
  type MetaValue,
  saveMetaGroupMutation,
} from "@/api/metainfo";
import { FieldLabel } from "@/components/field-label";
import { MetaValuePicker } from "@/components/metadata-value-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { canonicalJson } from "@/lib/combined";
import type { MetaValueCount } from "@/lib/meta-values";

interface MetaGroupEditorProps {
  info: MetaFieldInfo;
  /** The group to edit; undefined for a new one. */
  group?: MetaGroup;
  /** Every value of the field, to choose from. */
  values: MetaValueCount[];
  /** The field's groups, to keep two from sharing a name. */
  groups: MetaGroup[];
  /** After a save, with the group's ID. */
  onSaved: (id: string) => void;
  onRemoved: () => void;
}

/** The group as typed, as it would be saved. */
function drafted(info: MetaFieldInfo, group: MetaGroup | undefined, draft: Draft): MetaGroup {
  const name = draft.name.trim();
  const id = group?.id ?? metaGroupId(info.field, name);
  return {
    id,
    name,
    description: draft.description.trim(),
    field: info.field,
    values: draft.values,
  };
}

interface Draft {
  name: string;
  description: string;
  values: MetaValue[];
}

function startingDraft(group: MetaGroup | undefined): Draft {
  return group ? { ...group } : { name: "", description: "", values: [] };
}

/** Why the group can't be saved as typed, or "" when it can. */
function problem(next: MetaGroup, groups: MetaGroup[]): string {
  if (!next.name) return "Give the group a name.";
  const taken = groups.find(
    (g) => g.id !== next.id && g.name.toLowerCase() === next.name.toLowerCase(),
  );
  return taken ? `There's already a group named “${taken.name}”.` : "";
}

/** The ID of the group a save wrote, from its file name. */
function savedId(result: { path: string }): string {
  return result.path.replace(/^.*\//, "").replace(/\.json$/, "");
}

/** Edits one metadata group's name, description and values, and saves or removes it. */
export function MetaGroupEditor(props: MetaGroupEditorProps) {
  const { info, group, values } = props;
  const [draft, setDraft] = useState(() => startingDraft(group));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{group ? group.name : `New ${info.one} group`}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TextFields info={info} draft={draft} onChange={setDraft} />
        <MetaValuePicker
          info={info}
          values={values}
          chosen={draft.values}
          onChange={(chosen) => setDraft({ ...draft, values: chosen })}
        />
        <EditorButtons {...props} next={drafted(info, group, draft)} />
      </CardContent>
    </Card>
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
    <>
      <Button variant="outline" disabled={remove.isPending} onClick={() => remove.mutate(id)}>
        <Busy busy={remove.isPending} />
        Remove group
      </Button>
      <SaveNote error={remove.error} why="" />
    </>
  );
}

function Busy({ busy }: { busy: boolean }) {
  return busy ? <Spinner /> : null;
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
