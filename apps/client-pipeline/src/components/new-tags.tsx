import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createGroupMutation, organizeQuery } from "@/api/organize";
import { photosInFlightQuery } from "@/api/photos";
import { Button } from "@/components/ui/button";
import { type TagDefinition, type TagToMake, tagsToMake } from "@/lib/tag-prompt";

interface NewTagsProps {
  /** The new tags' IDs, in lowercase kebab-case. */
  names: string[];
  /** The LLM's definitions of the cultural terms among them, by ID, with any parent it suggests. */
  definitions: Record<string, TagDefinition>;
  /** The IDs of every tag there is, to say which suggested parents are new. */
  existing: ReadonlySet<string>;
  onCreated: (ids: string[]) => void;
  disabled: boolean;
}

/** `set` with `item` added when it's missing, or taken out when it's there. */
function toggled(set: ReadonlySet<string>, item: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(item)) next.add(item);
  return next;
}

/**
 * The names that aren't tags yet, each with the LLM's definition and the parent tag it suggests,
 * each of which can be left out, and a button that makes them: the definition becomes the tag's
 * description, and a suggested parent that isn't a tag yet is made too.
 */
export function NewTags({ names, definitions, existing, onCreated, disabled }: NewTagsProps) {
  const [chosen, setChosen] = useState(() => new Set(names));
  const [underParent, setUnderParent] = useState(() => new Set(names));
  const create = useCreateTags(onCreated);
  const busy = disabled || create.isPending;
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p>
        Not tags yet, written in lowercase kebab-case. Untick any you don&apos;t want, then make the
        rest:
      </p>
      <ul className="flex flex-col gap-1.5">
        {names.map((name) => (
          <NewTagRow
            key={name}
            name={name}
            definition={definitions[name]}
            parentIsNew={!existing.has(definitions[name]?.parent ?? "")}
            chosen={chosen.has(name)}
            underParent={underParent.has(name)}
            onToggle={() => setChosen(toggled(chosen, name))}
            onToggleParent={() => setUnderParent(toggled(underParent, name))}
            disabled={busy}
          />
        ))}
      </ul>
      <MakeButton
        count={chosen.size}
        disabled={busy}
        made={create.isSuccess}
        onClick={() =>
          create.mutate(
            tagsToMake(
              names.filter((name) => chosen.has(name)),
              definitions,
              underParent,
              existing,
            ),
          )
        }
      />
      {create.isError && <p className="text-destructive">{create.error.message}</p>}
    </div>
  );
}

interface NewTagRowProps {
  name: string;
  definition?: TagDefinition;
  /** Whether the suggested parent isn't a tag yet, so making this one makes it too. */
  parentIsNew: boolean;
  chosen: boolean;
  underParent: boolean;
  onToggle: () => void;
  onToggleParent: () => void;
  disabled: boolean;
}

/** One new tag's checkbox and definition, and a checkbox for the parent the LLM suggests. */
function NewTagRow(props: NewTagRowProps) {
  const { name, definition, chosen, onToggle, disabled } = props;
  return (
    <li className="flex flex-col gap-0.5">
      <label className="flex items-start gap-1.5">
        <input
          type="checkbox"
          className="mt-1"
          checked={chosen}
          disabled={disabled}
          onChange={onToggle}
        />
        <span>
          {name}
          <span className="text-muted-foreground">{definitionText(definition)}</span>
        </span>
      </label>
      <ParentChoice {...props} />
    </li>
  );
}

/** ": what it means", after a new tag's name, or nothing when the LLM didn't define it. */
function definitionText(definition?: TagDefinition): string {
  return definition?.definition ? `: ${definition.definition}` : "";
}

/** Says a suggested parent will be made too, when it isn't a tag yet. */
function parentNote(parentIsNew: boolean): string {
  return parentIsNew ? ", which is made too" : "";
}

/** The checkbox that puts a new tag under the parent the LLM suggests, when it suggests one. */
function ParentChoice({
  definition,
  parentIsNew,
  chosen,
  underParent,
  onToggleParent,
  disabled,
}: NewTagRowProps) {
  if (!definition?.parent) return null;
  return (
    <label className="text-muted-foreground ml-6 flex items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        checked={underParent}
        disabled={disabled || !chosen}
        onChange={onToggleParent}
      />
      Under <code className="text-foreground">{definition.parent}</code>
      {parentNote(parentIsNew)}
    </label>
  );
}

interface MakeButtonProps {
  /** How many new tags are ticked. */
  count: number;
  disabled: boolean;
  /** Whether they've been made already. */
  made: boolean;
  onClick: () => void;
}

/** Makes the ticked new tags, and says so once it has. */
function MakeButton({ count, disabled, made, onClick }: MakeButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="self-start"
      disabled={disabled || made || count === 0}
      onClick={onClick}
    >
      {made ? "Made and added" : makeLabel(count)}
    </Button>
  );
}

function makeLabel(count: number): string {
  return count === 1 ? "Make 1 new tag and add it" : `Make ${count} new tags and add them`;
}

/**
 * Makes each tag, one at a time and parents first, as changes waiting for Commit, then adds the
 * ones meant for the photo.
 */
function useCreateTags(onCreated: (ids: string[]) => void) {
  const queryClient = useQueryClient();
  const createTag = useMutation(createGroupMutation("tags"));
  return useMutation({
    mutationFn: async (tags: TagToMake[]) => {
      for (const { id, description, parent } of tags) {
        await createTag.mutateAsync({ id, name: id, description, parent });
      }
      return tags.filter((tag) => tag.add).map((tag) => tag.id);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey });
      void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
    },
    onSuccess: onCreated,
  });
}
