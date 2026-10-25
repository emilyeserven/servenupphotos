import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, CopyIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { metaGroups } from "@/api/metainfo";
import { type OrganizeResponse, createGroupMutation, groupId, organizeQuery } from "@/api/organize";
import { photosInFlightQuery } from "@/api/photos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { type PastedTags, matchTags, parseTagList, tagPrompt, withTags } from "@/lib/tag-prompt";
import { useCombinedData } from "@/stores/combined-data";

interface TagPromptCardProps {
  /** The public URL of the photo's version the prompt links to. */
  imageUrl: string;
  /** The tags being edited, by ID. */
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  /** Saving is under way, so changing the tags now would not change the file. */
  disabled: boolean;
}

/**
 * Copies a prompt that asks an LLM for the photo's tags, then takes the comma-separated list it
 * answers with and adds those tags to the ones being edited, making new tags for names that aren't
 * tags yet when asked. Save changes then saves them like any other edit.
 */
export function TagPromptCard(props: TagPromptCardProps) {
  const organize = useQuery(organizeQuery);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggest tags</CardTitle>
        <CardDescription>
          Copies a prompt for a chat with an LLM, with a link to the photo&apos;s Small version and
          every tag to reuse. Paste the list it answers with to add those tags.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {organize.data ? (
          <TagPromptSteps {...props} organize={organize.data} />
        ) : (
          <CopyPromptButton disabled prompt={() => ""} onCopied={() => {}} />
        )}
      </CardContent>
    </Card>
  );
}

/** The copy button, then, once the prompt is copied, the field for the LLM's answer. */
function TagPromptSteps({
  imageUrl,
  organize,
  ...rest
}: TagPromptCardProps & { organize: OrganizeResponse }) {
  const combined = useCombinedData();
  const groups = metaGroups(combined.data);
  const [copied, setCopied] = useState(false);
  return (
    <>
      <CopyPromptButton
        disabled={false}
        prompt={() => tagPrompt(imageUrl, { ...organize, metaGroups: groups })}
        onCopied={() => setCopied(true)}
      />
      {copied && (
        <PasteTags
          {...rest}
          organize={organize}
          match={(text) => matchTags(parseTagList(text), organize, groups)}
        />
      )}
    </>
  );
}

interface CopyPromptButtonProps {
  disabled: boolean;
  prompt: () => string;
  onCopied: () => void;
}

/** Copies the prompt, saying so for a moment. */
function CopyPromptButton({ disabled, prompt, onCopied }: CopyPromptButtonProps) {
  const [justCopied, setJustCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="self-start"
      disabled={disabled}
      onClick={() => {
        void navigator.clipboard.writeText(prompt()).then(() => {
          onCopied();
          setJustCopied(true);
          setTimeout(() => setJustCopied(false), 2000);
        });
      }}
    >
      {justCopied ? <CheckIcon /> : <CopyIcon />}
      {justCopied ? "Copied" : "Copy tag prompt"}
    </Button>
  );
}

interface PasteTagsProps {
  organize: OrganizeResponse;
  match: (text: string) => PastedTags;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  disabled: boolean;
}

/** The field to paste the LLM's answer into, and what adding it did. */
function PasteTags({ organize, match, tags, onTagsChange, disabled }: PasteTagsProps) {
  const [text, setText] = useState("");
  const [pasted, setPasted] = useState<Pasted | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="tag-prompt-answer" className="text-sm font-medium">
        The LLM&apos;s tags
      </label>
      <Textarea
        id="tag-prompt-answer"
        value={text}
        placeholder="temple, lanterns, festival"
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
      />
      <Button
        type="button"
        className="self-start"
        disabled={disabled || !text.trim()}
        onClick={() => {
          const found = match(text);
          onTagsChange(withTags(tags, found.existing));
          setPasted({ ...found, before: tags });
        }}
      >
        <SparklesIcon />
        Add tags
      </Button>
      {pasted && (
        <PastedSummary
          pasted={pasted}
          organize={organize}
          onCreated={(ids) => onTagsChange(withTags(tags, ids))}
          disabled={disabled}
        />
      )}
    </div>
  );
}

/** "a, b and c" */
function joined(names: string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The tags pasted, with the photo's tags before they were added. */
type Pasted = PastedTags & { before: string[] };

/** Which existing tags were added, and which the photo already had. */
function existingLine({ existing, before }: Pasted, names: Map<string, string>): string {
  const label = (ids: string[]) => joined(ids.map((id) => names.get(id) ?? id));
  const added = existing.filter((id) => !before.includes(id));
  const had = existing.filter((id) => before.includes(id));
  const parts = [
    added.length > 0 ? `Added ${label(added)}; Save changes saves them.` : "",
    had.length > 0 ? `Already tagged ${label(had)}.` : "",
  ];
  return parts.join(" ").trim() || "None of these are tags yet.";
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
        <NewTags names={pasted.fresh} onCreated={onCreated} disabled={disabled} />
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
  onCreated: (ids: string[]) => void;
  disabled: boolean;
}

/** The names that aren't tags yet, each of which can be left out, and a button that makes them. */
function NewTags({ names, onCreated, disabled }: NewTagsProps) {
  const [chosen, setChosen] = useState(() => new Set(names));
  const create = useCreateTags(onCreated);
  const toggle = (name: string) => {
    const next = new Set(chosen);
    if (!next.delete(name)) next.add(name);
    setChosen(next);
  };
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p>Not tags yet. Untick any you don&apos;t want, then make the rest:</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {names.map((name) => (
          <label key={name} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={chosen.has(name)}
              disabled={disabled || create.isPending}
              onChange={() => toggle(name)}
            />
            {name}
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

/** Makes a new tag for each name, one at a time, as changes waiting for Commit, then adds them. */
function useCreateTags(onCreated: (ids: string[]) => void) {
  const queryClient = useQueryClient();
  const createTag = useMutation(createGroupMutation("tags"));
  return useMutation({
    mutationFn: async (names: string[]) => {
      const ids: string[] = [];
      for (const name of names) {
        const id = groupId(name);
        await createTag.mutateAsync({ id, name, description: "" });
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
