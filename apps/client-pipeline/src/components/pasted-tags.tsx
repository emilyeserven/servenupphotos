import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ClipboardEvent, useState } from "react";
import { metaGroups } from "@/api/metainfo";
import { type OrganizeResponse, createGroupMutation, groupId, organizeQuery } from "@/api/organize";
import { photosInFlightQuery } from "@/api/photos";
import { Button } from "@/components/ui/button";
import {
  type PastedTags,
  matchTags,
  parseDefinitions,
  parseTagList,
  withTags,
} from "@/lib/tag-prompt";
import { useCombinedData } from "@/stores/combined-data";

/** "a, b and c" */
function joined(names: string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The tags pasted, with the photo's tags before they were added and the LLM's definitions, by ID. */
type Pasted = PastedTags & { before: string[]; definitions: Record<string, string> };

/** Which existing tags were added, and which the photo already had. */
function existingLine({ existing, before }: Pasted, names: Map<string, string>): string {
  const label = (ids: string[]) => joined(ids.map((id) => names.get(id) ?? id));
  const added = existing.filter((id) => !before.includes(id));
  const had = existing.filter((id) => before.includes(id));
  const parts = [
    added.length > 0 ? `Added ${label(added)}.` : "",
    had.length > 0 ? `Already tagged ${label(had)}.` : "",
  ];
  return parts.join(" ").trim() || "None of these are tags yet.";
}

/**
 * What pasting a comma-separated list into a Tags field needs: `onPaste` for the field, which adds
 * the tags the list names, and `summary`, which says what it added and offers to make the rest.
 * Text without a comma or a new line pastes as usual, into the field's search.
 */
export function useTagPaste(
  tags: string[],
  onTagsChange: (tags: string[]) => void,
  disabled = false,
) {
  const organize = useQuery(organizeQuery);
  const combined = useCombinedData();
  const groups = metaGroups(combined.data);
  const [pasted, setPasted] = useState<Pasted | null>(null);
  const onPaste = (event: ClipboardEvent) => {
    const text = event.clipboardData.getData("text");
    if (!organize.data || !/[,\n]/.test(text)) return;
    event.preventDefault();
    const found = matchTags(parseTagList(text), organize.data, groups);
    onTagsChange(withTags(tags, found.existing));
    setPasted({ ...found, before: tags, definitions: parseDefinitions(text) });
  };
  const summary = pasted && organize.data && (
    <PastedSummary
      key={pasted.fresh.join()}
      pasted={pasted}
      organize={organize.data}
      onCreated={(ids) => onTagsChange(withTags(tags, ids))}
      disabled={disabled}
    />
  );
  return { onPaste, summary };
}

interface PastedSummaryProps {
  pasted: Pasted;
  organize: OrganizeResponse;
  onCreated: (ids: string[]) => void;
  disabled: boolean;
}

/** Which tags were added, which can be made as new tags, and which were left out. */
function PastedSummary({ pasted, organize, onCreated, disabled }: PastedSummaryProps) {
  const names = new Map(organize.tags.map((tag) => [tag.id, tag.name || tag.id]));
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted-foreground">{existingLine(pasted, names)}</p>
      {pasted.fresh.length > 0 && (
        <NewTags
          names={pasted.fresh}
          definitions={pasted.definitions}
          onCreated={onCreated}
          disabled={disabled}
        />
      )}
      {pasted.skipped.map(({ name, reason }) => (
        <p key={name} className="text-muted-foreground">
          Left out “{name}”: {reason}.
        </p>
      ))}
    </div>
  );
}

interface NewTagsProps {
  names: string[];
  /** The LLM's definitions of the cultural terms among them, by ID, saved as their descriptions. */
  definitions: Record<string, string>;
  onCreated: (ids: string[]) => void;
  disabled: boolean;
}

/** The names that aren't tags yet, each of which can be left out, and a button that makes them. */
function NewTags({ names, definitions, onCreated, disabled }: NewTagsProps) {
  const [chosen, setChosen] = useState(() => new Set(names));
  const create = useCreateTags(definitions, onCreated);
  const toggle = (name: string) => {
    const next = new Set(chosen);
    if (!next.delete(name)) next.add(name);
    setChosen(next);
  };
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p>
        Not tags yet, written in lowercase kebab-case. Untick any you don&apos;t want, then make the
        rest:
      </p>
      <div className="flex flex-col gap-1">
        {names.map((name) => (
          <label key={name} className="flex items-start gap-1.5">
            <input
              type="checkbox"
              className="mt-1"
              checked={chosen.has(name)}
              disabled={disabled || create.isPending}
              onChange={() => toggle(name)}
            />
            <span>
              {name}
              {definitions[name] && (
                <span className="text-muted-foreground">: {definitions[name]}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      <MakeButton
        count={chosen.size}
        disabled={disabled || create.isPending}
        made={create.isSuccess}
        onClick={() => create.mutate(names.filter((name) => chosen.has(name)))}
      />
      {create.isError && <p className="text-destructive">{create.error.message}</p>}
    </div>
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

/** Makes a new tag for each name, with its definition as its description, one at a time, as changes waiting for Commit, then adds them. */
function useCreateTags(definitions: Record<string, string>, onCreated: (ids: string[]) => void) {
  const queryClient = useQueryClient();
  const createTag = useMutation(createGroupMutation("tags"));
  return useMutation({
    mutationFn: async (names: string[]) => {
      const ids: string[] = [];
      for (const name of names) {
        const id = groupId(name);
        await createTag.mutateAsync({ id, name: id, description: definitions[id] ?? "" });
        ids.push(id);
      }
      return ids;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey });
      void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
    },
    onSuccess: onCreated,
  });
}
