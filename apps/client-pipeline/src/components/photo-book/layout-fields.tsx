import type { ReactNode } from "react";
import { RatioFields } from "@/components/photo-book/ratio-fields";
import { Button } from "@/components/ui/button";
import { type LayoutLook, textBeside, titlePlace } from "@/lib/photo-book-layouts";

/** One setting's name over its control. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

/** Buttons for each of a setting's choices, the one set pressed. */
export function Choices<T extends string | number>(props: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  const { label, value, options, onChange } = props;
  return (
    <Field label={label}>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map(([option, name]) => (
          <Button
            key={option}
            size="sm"
            role="radio"
            aria-checked={option === value}
            variant={option === value ? "secondary" : "outline"}
            onClick={() => onChange(option)}
          >
            {name}
          </Button>
        ))}
      </div>
    </Field>
  );
}

/** A slider for a share of the page, in percent, with its value beside it. */
function Percent(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const { label, value, min, max, onChange } = props;
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={0.5}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="accent-primary min-w-0 flex-1"
        />
        <span className="text-muted-foreground w-12 text-right text-sm tabular-nums">{value}%</span>
      </div>
    </Field>
  );
}

/** The ratio a layout's photos start with when Custom ratio is picked: 4:5, a common print size. */
const DEFAULT_RATIO = { width: 4, height: 5 };

/** The photo settings: how many, how they're arranged, and their shape. */
function PhotoFields({ look, onChange }: LayoutFieldsProps) {
  return (
    <>
      <Choices
        label="Photos"
        value={look.photos}
        options={[1, 2, 3, 4].map((n) => [n, String(n)])}
        onChange={(photos) => onChange({ photos })}
      />
      <Choices
        label="Arrange the photos"
        value={look.arrange}
        options={[
          ["stack", "One under another"],
          ["row", "Side by side"],
        ]}
        onChange={(arrange) => onChange({ arrange })}
      />
      <Choices
        label="Photo size"
        value={look.shape}
        options={[
          ["landscape", "Landscape 3:2"],
          ["portrait", "Portrait 2:3"],
          ["square", "Square"],
          ["ratio", "Custom ratio"],
          ["fill", "Fill the room"],
        ]}
        onChange={(shape) =>
          onChange(shape === "ratio" ? { shape, ratio: look.ratio ?? DEFAULT_RATIO } : { shape })
        }
      />
      {look.shape === "ratio" && (
        <RatioFields
          ratio={look.ratio ?? DEFAULT_RATIO}
          onChange={(ratio) => onChange({ ratio })}
        />
      )}
    </>
  );
}

/** What the text alignment choices are called, for text beside the photos and above or below them. */
const ALIGN_OPTIONS: Record<"beside" | "across", [LayoutLook["align"], string][]> = {
  beside: [
    ["start", "Top"],
    ["center", "Middle"],
    ["end", "Bottom"],
  ],
  across: [
    ["start", "Start"],
    ["center", "Middle"],
    ["end", "End"],
  ],
};

/** The text settings: its side, together or by each photo, its room and where it sits. */
function TextFields({ look, onChange }: LayoutFieldsProps) {
  return (
    <>
      <Choices
        label="Title and captions"
        value={look.text}
        options={[
          ["left", "Left"],
          ["right", "Right"],
          ["above", "Above"],
          ["below", "Below"],
        ]}
        onChange={(text) => onChange({ text })}
      />
      <Choices
        label="Captions"
        value={look.captions}
        options={[
          ["column", "Together in one column"],
          ["photo", "Beside each photo"],
        ]}
        onChange={(captions) => onChange({ captions })}
      />
      <Choices
        label="Page title"
        value={titlePlace(look)}
        options={[
          ["text", "With the captions"],
          ["top", "Across the top"],
          ["off", "None"],
        ]}
        onChange={(title) => onChange({ title })}
      />
      <Choices
        label="Text sits"
        value={look.align}
        options={ALIGN_OPTIONS[textBeside(look) ? "beside" : "across"]}
        onChange={(align) => onChange({ align })}
      />
      <Choices
        label="Line the text up with"
        value={look.alignTo ?? "room"}
        options={[
          ["room", "The photo's room"],
          ["photo", "The photo itself"],
        ]}
        onChange={(alignTo) => onChange({ alignTo })}
      />
    </>
  );
}

interface LayoutFieldsProps {
  look: LayoutLook;
  onChange: (change: Partial<LayoutLook>) => void;
}

/**
 * Every setting of a layout made on the Layouts tab: its photos, where its title and captions go,
 * and how much room the text, the gaps and the margin take.
 */
export function LayoutFields({ look, onChange }: LayoutFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <PhotoFields look={look} onChange={onChange} />
      <TextFields look={look} onChange={onChange} />
      <Percent
        label="Room for the text"
        value={look.textShare}
        min={10}
        max={60}
        onChange={(textShare) => onChange({ textShare })}
      />
      <Percent
        label="Gap"
        value={look.gap}
        min={0}
        max={20}
        onChange={(gap) => onChange({ gap })}
      />
      <Percent
        label="Margin"
        value={look.margin}
        min={0}
        max={20}
        onChange={(margin) => onChange({ margin })}
      />
    </div>
  );
}
