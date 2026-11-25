import { TagIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TagButtonProps {
  /** What the page or spread is called, for the button's label. */
  name: string;
  tags: string[];
  /** Every tag in the book, offered while typing. */
  all: string[];
  onChange: (tags: string[]) => void;
  /** True for a button with the words **Add tag** beside its icon, as on Photo Pages. */
  labeled?: boolean;
}

/**
 * The tag button on a page or spread: a flyout with its tags, each with an × that takes it off, the
 * book's other tags to add with a click, and a box that adds a new one.
 */
export function TagButton({ name, tags, all, onChange, labeled }: TagButtonProps) {
  const others = all.filter((tag) => !tags.includes(tag));
  const add = (tag: string) => onChange([...tags, tag]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        {labeled ? (
          <Button size="xs" variant="ghost" aria-label={`Tags of ${name}`}>
            <TagIcon />
            Add tag
          </Button>
        ) : (
          <Button
            size="icon-xs"
            variant={tags.length > 0 ? "secondary" : "ghost"}
            aria-label={`Tags of ${name}`}
            title="Tags"
          >
            <TagIcon />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={labeled ? "start" : "end"} className="flex w-64 flex-col gap-2 p-3">
        <TagChips tags={tags} onRemove={(tag) => onChange(tags.filter((t) => t !== tag))} />
        <BookTagChoices tags={others} onAdd={add} />
        <NewTagForm others={others} onAdd={add} />
      </PopoverContent>
    </Popover>
  );
}

/** A box that adds a new tag, offering the book's other tags as it's typed in. */
function NewTagForm({ others, onAdd }: { others: string[]; onAdd: (tag: string) => void }) {
  const [text, setText] = useState("");
  const list = useId();
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim()) onAdd(text.trim());
        setText("");
      }}
    >
      <Input
        aria-label="New tag"
        list={list}
        value={text}
        placeholder="New tag: by place, by theme…"
        onChange={(event) => setText(event.target.value)}
        className="h-8"
      />
      <datalist id={list}>
        {others.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <Button type="submit" size="sm" variant="outline" disabled={!text.trim()}>
        Add
      </Button>
    </form>
  );
}

/** The book's tags not on the page or spread yet, each a button that adds it. */
function BookTagChoices({ tags, onAdd }: { tags: string[]; onAdd: (tag: string) => void }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">This book&apos;s tags</span>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-label={`Add ${tag}`}
            onClick={() => onAdd(tag)}
            className="hover:bg-accent rounded-full border px-2 py-0.5 text-xs"
          >
            + {tag}
          </button>
        ))}
      </div>
    </div>
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
