import { useQuery } from "@tanstack/react-query";
import { type ClipboardEvent, useState } from "react";
import { metaGroups } from "@/api/metainfo";
import { type OrganizeResponse, organizeQuery } from "@/api/organize";
import { NewTags } from "@/components/new-tags";
import {
  type PastedTags,
  type TagDefinition,
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
type Pasted = PastedTags & { before: string[]; definitions: Record<string, TagDefinition> };

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
          existing={new Set(organize.tags.map((tag) => tag.id))}
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
