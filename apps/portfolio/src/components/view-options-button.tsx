import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";
import { cn } from "@/lib/utils";

/**
 * An eye button that opens a view's display options in a flyout, such as the map's pin size or the
 * Timeline's thumbnail size. `label` names it for the tooltip and screen readers, and `onReset`, when
 * given, adds a **Reset to defaults** link under the options.
 */
export function ViewOptionsButton({
  label = "Display options",
  onReset,
  contentClassName,
  children,
}: {
  label?: string;
  onReset?: () => void;
  /** Extra classes for the flyout, such as a wider width. */
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={label}
          aria-label={label}
          className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-xs outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring dark:border-input"
        >
          <Eye className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("flex w-64 flex-col gap-4 p-3 text-sm", contentClassName)}
      >
        {children}
        {onReset && <ResetLink onClick={onReset} />}
      </PopoverContent>
    </Popover>
  );
}

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

/** A labelled checkbox for one of the options. */
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
