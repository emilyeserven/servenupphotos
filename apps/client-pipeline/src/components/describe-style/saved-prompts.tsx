import { useNavigate, useSearch } from "@tanstack/react-router";
import { SaveIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { parseGridFilters } from "@/components/gallery/grid-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type SavedStylePrompt, useStylePromptsStore } from "@/stores/style-prompts";

interface SavedPromptsProps {
  /** How many photos to link, as typed, to save. */
  count: string;
  /** The Anything to focus on question, to save. */
  focus: string;
  /** Sets the page's count and question from a loaded prompt. */
  onLoad: (prompt: SavedStylePrompt) => void;
}

/**
 * Saves the page's filters, count and question under a name in this browser's local storage, and
 * lists the saved ones to load again or delete.
 */
export function SavedPrompts({ count, focus, onLoad }: SavedPromptsProps) {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const { prompts, save, remove } = useStylePromptsStore();
  const [name, setName] = useState("");
  const load = (prompt: SavedStylePrompt) => {
    void navigate({ to: "/describe-style", search: prompt.filters });
    onLoad(prompt);
    setName(prompt.name);
  };
  const saveCurrent = () =>
    save({
      name: name.trim(),
      filters: parseGridFilters(search),
      count,
      focus,
      savedAt: new Date().toISOString(),
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved prompts</CardTitle>
        <CardDescription>
          Saves the filters, the number of photos and the question under a name, in this
          browser&apos;s local storage, to load again later. Saving under a name already used
          replaces it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            saveCurrent();
          }}
        >
          <Input
            aria-label="Name to save the prompt as"
            placeholder="Such as: Japan 2026"
            className="w-64"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" variant="outline" disabled={name.trim() === ""}>
            <SaveIcon />
            Save
          </Button>
        </form>
        {prompts.length > 0 && (
          <ul className="flex flex-col divide-y text-sm">
            {prompts.map((prompt) => (
              <SavedPromptRow
                key={prompt.name}
                prompt={prompt}
                onLoad={() => load(prompt)}
                onRemove={() => remove(prompt.name)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** How many filters the saved prompt has set, such as "2 filters", or "No filters". */
function filterCount(prompt: SavedStylePrompt): string {
  const count = Object.values(prompt.filters).filter((value) => value !== undefined).length;
  if (count === 0) return "No filters";
  return count === 1 ? "1 filter" : `${count} filters`;
}

interface SavedPromptRowProps {
  prompt: SavedStylePrompt;
  onLoad: () => void;
  onRemove: () => void;
}

/** One saved prompt: its name, what it holds, and the buttons that load or delete it. */
function SavedPromptRow({ prompt, onLoad, onRemove }: SavedPromptRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{prompt.name}</span>
        <span className="text-muted-foreground truncate text-xs">
          {filterCount(prompt)} · {prompt.count} photos
          {prompt.focus.trim() && ` · ${prompt.focus.trim()}`}
        </span>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onLoad}>
        Load
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`Delete ${prompt.name}`}
        onClick={onRemove}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}
