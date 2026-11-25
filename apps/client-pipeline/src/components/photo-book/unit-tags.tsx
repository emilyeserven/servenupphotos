import { TagIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TagButtonProps {
  /** What the page or spread is called, for the button's label. */
  name: string;
  tags: string[];
  /** Every tag in the book, offered while typing. */
  all: string[];
  onChange: (tags: string[]) => void;
}

/**
 * The tag button on a page or spread: a flyout with its tags, each with an × that takes it off, and
 * a box that adds one, offering the book's other tags.
 */
export function TagButton({ name, tags, all, onChange }: TagButtonProps) {
  const [text, setText] = useState("");
  const list = useId();
  const add = () => {
    if (text.trim()) onChange([...tags, text.trim()]);
    setText("");
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon-xs"
          variant={tags.length > 0 ? "secondary" : "ghost"}
          aria-label={`Tags of ${name}`}
          title="Tags"
        >
          <TagIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-2 p-3">
        <TagChips tags={tags} onRemove={(tag) => onChange(tags.filter((t) => t !== tag))} />
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <Input
            aria-label="New tag"
            list={list}
            value={text}
            placeholder="by place, by theme…"
            onChange={(event) => setText(event.target.value)}
            className="h-8"
          />
          <datalist id={list}>
            {all
              .filter((tag) => !tags.includes(tag))
              .map((tag) => (
                <option key={tag} value={tag} />
              ))}
          </datalist>
          <Button type="submit" size="sm" variant="outline" disabled={!text.trim()}>
            Add
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** The tags as small chips, each with an × that takes it off when onRemove is given. */
export function TagChips(props: { tags: string[]; onRemove?: (tag: string) => void }) {
  const { tags, onRemove } = props;
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Tags">
      {tags.map((tag) => (
        <li
          key={tag}
          className="bg-secondary text-secondary-foreground flex items-center gap-0.5 rounded px-1.5 text-[11px]"
        >
          {tag}
          {onRemove && (
            <button type="button" aria-label={`Take off ${tag}`} onClick={() => onRemove(tag)}>
              <XIcon className="size-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The drawer's tag filter: All, then a button for each of the book's tags, the one picked pressed. */
export function TagFilter(props: {
  tags: string[];
  value: string | null;
  onChange: (tag: string | null) => void;
}) {
  const { tags, value, onChange } = props;
  if (tags.length === 0) return null;
  return (
    <div role="radiogroup" aria-label="Show pages tagged" className="flex flex-wrap gap-1">
      {[null, ...tags].map((tag) => (
        <button
          key={tag ?? ""}
          type="button"
          role="radio"
          aria-checked={tag === value}
          onClick={() => onChange(tag)}
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs",
            tag === value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
          )}
        >
          {tag ?? "All"}
        </button>
      ))}
    </div>
  );
}
