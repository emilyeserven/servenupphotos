import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { organizeQuery, setTagDescriptionsMutation } from "@/api/organize";
import { Textarea } from "@/components/ui/textarea";
import { SaveButton, count } from "@/components/update-data-shared";
import type { TagDescriptionAnswer, TagDescriptionsRead } from "@/lib/tag-description-prompt";

/** Saves the reviewed descriptions, then reads the tags again so the next batch leaves them out. */
export function useSaveDescriptions() {
  const queryClient = useQueryClient();
  return useMutation({
    ...setTagDescriptionsMutation,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey }),
  });
}

/** The mutation that saves descriptions, shared by the card and the review inside its batch. */
export type SaveDescriptions = ReturnType<typeof useSaveDescriptions>;

interface TagDescriptionReviewProps {
  read: TagDescriptionsRead;
  save: SaveDescriptions;
}

/** The ticked descriptions, by tag ID, leaving out any that were emptied. */
function ticked(texts: Record<string, string>, chosen: ReadonlySet<string>) {
  return Object.fromEntries(
    Object.entries(texts)
      .map(([id, text]) => [id, text.trim()] as const)
      .filter(([id, text]) => chosen.has(id) && text !== ""),
  );
}

/**
 * The review of the LLM's answer: each tag it describes with its description, which can be edited
 * or unticked, then a button that saves the rest. A tag that has a description already starts
 * unticked, showing the one it has.
 */
export function TagDescriptionReview({ read, save }: TagDescriptionReviewProps) {
  const [texts, setTexts] = useState(() =>
    Object.fromEntries(read.found.map((tag) => [tag.id, tag.description])),
  );
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(read.found.filter((tag) => !tag.current).map((tag) => tag.id)),
  );
  const descriptions = ticked(texts, chosen);
  const saving = Object.keys(descriptions).length;
  const busy = save.isPending;
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (!next.delete(id)) next.add(id);
    setChosen(next);
  };
  return (
    <div className="flex flex-col gap-4 border-t pt-6 text-sm">
      <UnknownTags names={read.unknown} />
      {read.found.length === 0 && (
        <p className="text-muted-foreground">The answer doesn&apos;t describe any of the tags.</p>
      )}
      <ul className="flex flex-col gap-3">
        {read.found.map((tag) => (
          <DescriptionRow
            key={tag.id}
            tag={tag}
            text={texts[tag.id] ?? ""}
            checked={chosen.has(tag.id)}
            disabled={busy}
            onToggle={() => toggle(tag.id)}
            onEdit={(text) => setTexts({ ...texts, [tag.id]: text })}
          />
        ))}
      </ul>
      <SaveButton
        label={`Save ${count(saving, "description")}`}
        disabled={saving === 0}
        pending={busy}
        error={save.error}
        onClick={() => save.mutate(descriptions)}
      />
    </div>
  );
}

/** Says which names in the answer aren't tags, when it has any. */
function UnknownTags({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p className="text-muted-foreground">
      Left out the answer&apos;s descriptions for {names.map((name) => `“${name}”`).join(", ")},
      which {names.length === 1 ? "isn’t a tag" : "aren’t tags"}.
    </p>
  );
}

interface DescriptionRowProps {
  tag: TagDescriptionAnswer;
  text: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  onEdit: (text: string) => void;
}

/** One tag's checkbox and its description to edit, with the one it has now when it has one. */
function DescriptionRow({ tag, text, checked, disabled, onToggle, onEdit }: DescriptionRowProps) {
  return (
    <li className="flex flex-col gap-1.5 rounded-md border p-3">
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} />
        <code>{tag.id}</code>
      </label>
      {tag.current && <p className="text-muted-foreground text-xs">Has “{tag.current}” already.</p>}
      <Textarea
        aria-label={`Description of ${tag.id}`}
        className="min-h-0 text-sm"
        rows={2}
        value={text}
        disabled={disabled || !checked}
        onChange={(event) => onEdit(event.target.value)}
      />
    </li>
  );
}
