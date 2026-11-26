import { ArrowDownIcon, ArrowUpIcon, ShuffleIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLACE_COUNTS, type PlaceCount, type PlaceForm } from "@/lib/caption-place-form";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

/** A photo that uses a form, by name, with the place name the form makes for it. */
export interface FormExample {
  /** The photo's name: its title, or else its file. */
  photo: string;
  /** The place name the form makes for it. */
  text: string;
}

interface PlaceFormRowProps {
  form: PlaceForm;
  /** The form's place in the list, from 0, and how many forms there are. */
  index: number;
  total: number;
  /** The photos the form is used for, with what it makes for each. */
  examples: FormExample[];
  /** Which of examples is shown. */
  shown: number;
  onShuffle: () => void;
  onChange: (form: PlaceForm) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  /** Notes the form's text box, so a placeholder clicked goes in it. */
  onFocus: (input: HTMLInputElement) => void;
}

/** What the form makes for one of the photos it's used for, as the caption shows it, with Shuffle for another. */
function FormPreview({
  examples,
  shown,
  onShuffle,
}: Pick<PlaceFormRowProps, "examples" | "shown" | "onShuffle">) {
  const example = examples[shown % Math.max(examples.length, 1)];
  if (!example) {
    return (
      <EmptyNote className="text-xs">
        No photo uses this form: an earlier one fits them first, or a placeholder in it is empty for
        them.
      </EmptyNote>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="bg-muted rounded-md px-2 py-1 text-sm">{example.text}</span>
      <span className="text-muted-foreground text-xs">
        {`for “${example.photo}”, one of ${count(examples.length, "photo")} it's used for`}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={examples.length < 2}
        onClick={onShuffle}
        aria-label="Show another photo this form is used for"
      >
        <ShuffleIcon />
        Shuffle
      </Button>
    </div>
  );
}

/** The buttons that move a form up or down the list, or take it off. */
function FormButtons({
  index,
  total,
  onMove,
  onRemove,
}: Pick<PlaceFormRowProps, "index" | "total" | "onMove" | "onRemove">) {
  return (
    <div className="flex">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUpIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Move down"
        disabled={index === total - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDownIcon />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Remove this form" onClick={onRemove}>
        <XIcon />
      </Button>
    </div>
  );
}

/** One form of the place name builder: the places it's for, its text, and what it makes for a photo it's used for. */
export function PlaceFormRow(props: PlaceFormRowProps) {
  const { form, index, onChange, onFocus } = props;
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground w-5 text-sm tabular-nums">{index + 1}.</span>
        <select
          aria-label={`Form ${index + 1} is for`}
          value={form.when}
          onChange={(event) => onChange({ ...form, when: event.target.value as PlaceCount })}
          className="border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs"
        >
          {PLACE_COUNTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Input
          aria-label={`Form ${index + 1}`}
          value={form.text}
          placeholder="{city}, {country}"
          onFocus={(event) => onFocus(event.currentTarget)}
          onChange={(event) => onChange({ ...form, text: event.target.value })}
          className="min-w-48 flex-1 font-mono text-sm"
        />
        <FormButtons {...props} />
      </div>
      <FormPreview {...props} />
    </li>
  );
}
