import { ArrowDownIcon, ArrowUpIcon, ShuffleIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { FormCondition } from "@/components/caption-templates/form-condition";
import { FormView } from "@/components/caption-templates/form-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlaceForm } from "@/lib/caption-place-form";
import type { CaptionValues } from "@/lib/caption-template";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

/** A photo that uses a form, by name, with the place name the form makes for it. */
export interface FormExample {
  /** The photo's name: its title, or else its file. */
  photo: string;
  /** The place name the form makes for it. */
  text: string;
  /** Its caption values, which the form is drawn with. */
  values: CaptionValues;
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
  /** The values to draw the form with when no photo uses it. */
  fallback: CaptionValues;
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

/** The values of the photo the form is shown for: the one shown, or else the fallback. */
function shownValues({ examples, shown, fallback }: PlaceFormRowProps): CaptionValues {
  return examples[shown % Math.max(examples.length, 1)]?.values ?? fallback;
}

/**
 * The form's text: drawn as the caption shows it for the photo shown, until clicked, then typed in
 * with its placeholders in braces; typed in while it's empty.
 */
function FormText(props: PlaceFormRowProps) {
  const { form, index, onChange, onFocus } = props;
  const [editing, setEditing] = useState(false);
  if (!editing && form.text.trim() !== "") {
    return (
      <FormView
        text={form.text}
        values={shownValues(props)}
        label={`Form ${index + 1}: click to edit`}
        onEdit={() => setEditing(true)}
      />
    );
  }
  return (
    <Input
      aria-label={`Form ${index + 1}`}
      autoFocus={editing}
      value={form.text}
      placeholder="{city}, {country}"
      onFocus={(event) => onFocus(event.currentTarget)}
      onBlur={() => setEditing(false)}
      onChange={(event) => onChange({ ...form, text: event.target.value })}
      className="min-w-48 flex-1 font-mono text-sm"
    />
  );
}

/** One form of the place name builder: the photos it's for, its text, and what it makes for a photo it's used for. */
export function PlaceFormRow(props: PlaceFormRowProps) {
  const { form, index, onChange } = props;
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground w-5 text-sm tabular-nums">{index + 1}.</span>
        <FormText {...props} />
        <FormButtons {...props} />
      </div>
      <FormCondition form={form} index={index} onChange={onChange} />
      <FormPreview {...props} />
    </li>
  );
}
