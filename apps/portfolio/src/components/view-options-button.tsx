import { Eye } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
import { CONTROL_FRAME, controlButtonClass } from "@portfolio/lib/segmented-control";
import { cn } from "@portfolio/lib/utils";

/**
 * The **Display Options** button that opens a view's display options in a flyout, such as the
 * Timeline's thumbnail size or the map's pin size. Every view's flyout has the same wide layout:
 * `choices` (sizes, sliders and other picks) in the left column and `checks` (checkboxes, each set
 * in an `OptionGroup`) in the right, stacked on a phone, then **Reset to defaults** under both when
 * `onReset` is given.
 *
 * The button says "Display Options" beside its eye. `iconOnly` leaves just the eye, for a view with
 * no room for words, such as the Map's floating controls. `align` is which edge of the button the
 * flyout lines up with: "end" for a button at the right end of a row.
 */
export function ViewOptionsButton({
  iconOnly = false,
  align = "start",
  onReset,
  choices,
  checks,
}: {
  /** Shows the eye alone, named only for the tooltip and screen readers. */
  iconOnly?: boolean;
  /** Which edge of the button the flyout lines up with, such as "end" for a button on the right. */
  align?: "start" | "end";
  onReset?: () => void;
  /** The left column: `OptionChoices` and other picks, top to bottom. */
  choices: ReactNode;
  /** The right column: one or more `OptionGroup`s of checkboxes. */
  checks: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <TriggerButton iconOnly={iconOnly} />
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="flex w-auto max-w-[calc(100vw-2rem)] flex-col gap-4 p-3 text-sm"
      >
        <div className="grid gap-4 sm:grid-cols-[auto_auto] sm:gap-8">
          <div className="flex flex-col gap-4">{choices}</div>
          <div className="flex flex-col gap-4">{checks}</div>
        </div>
        {onReset && <ResetLink onClick={onReset} />}
      </PopoverContent>
    </Popover>
  );
}

/** The flyout button's name, written on it and read out by screen readers. */
const LABEL = "Display Options";

/** The eye that opens the flyout, with "Display Options" written beside it unless `iconOnly`. */
function TriggerButton({ iconOnly, ...props }: { iconOnly: boolean }) {
  return (
    <button
      type="button"
      title={LABEL}
      aria-label={iconOnly ? LABEL : undefined}
      className={cn(TRIGGER_CLASS, iconOnly ? "size-8" : LABELLED_CLASS)}
      {...props}
    >
      <Eye className="size-4" aria-hidden />
      {!iconOnly && LABEL}
    </button>
  );
}

/** The eye button's look, with or without its words. */
const TRIGGER_CLASS =
  "inline-flex items-center justify-center rounded-md border bg-background text-muted-foreground shadow-xs outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring dark:border-input";

/** The worded button's size, matching the small outline buttons beside it such as Show filters. */
const LABELLED_CLASS = "h-8 gap-1.5 px-2.5 text-sm font-medium text-foreground";

/** A labelled row of buttons in the options that picks one of a few choices, such as a size. */
export function OptionChoices<T extends string>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  /** Each choice with its label, in the order they're shown. */
  choices: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className={CONTROL_FRAME} role="group" aria-label={label}>
        {choices.map(([choice, choiceLabel]) => (
          <button
            key={choice}
            type="button"
            aria-pressed={value === choice}
            onClick={() => onChange(choice)}
            className={controlButtonClass(value === choice)}
          >
            {choiceLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A titled set of checkboxes in the flyout's right column, such as the Timeline's **Each photo**.
 * The title names what the checkboxes change, so each checkbox can be short.
 */
export function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby={id}>
      <span id={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/** A labelled checkbox for one of the options, inside an `OptionGroup`. */

export function OptionCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 cursor-pointer accent-primary"
      />
      {label}
    </label>
  );
}

/** The link at the bottom of the options that puts them all back. */
function ResetLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      Reset to defaults
    </button>
  );
}
