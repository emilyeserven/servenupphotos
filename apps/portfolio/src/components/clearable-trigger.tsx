import { ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { ClearFilterButton } from "@portfolio/components/clear-filter-button";
import { cn } from "@portfolio/lib/utils";

/**
 * The classes that hide the end of a filter button, such as its arrows or its count, while the
 * clear X shows in its place: while the button is pointed at or reached with the keyboard, and always on a touch
 * screen, which can't point.
 */
const SWAPPED_OUT =
  "group-hover/clear:opacity-0 group-has-[:focus-visible]/clear:opacity-0 pointer-coarse:opacity-0";

/**
 * A filter button with the clear X: while `count` of its filters are set, pointing at the button
 * (or reaching it with the keyboard) swaps the end of it for an X that clears them all, such as **When**'s arrows or
 * **Show filters**' count. On a touch screen the X always shows while any is set. The X sits over
 * the button, inside its border, as a button can't hold another; the button marks the part it
 * covers with `SwapOut` or `TriggerArrows`.
 */
export function ClearableTrigger({
  label,
  count,
  onClear,
  children,
}: {
  /** The filter's name for screen readers, such as "When", read as "Clear When". */
  label: string;
  count: number;
  onClear: () => void;
  /** The button. */
  children: ReactNode;
}) {
  return (
    <div className="group/clear relative inline-flex items-center">
      {children}
      {count > 0 && (
        <ClearFilterButton
          label={label}
          onClear={onClear}
          className="absolute right-2 opacity-0 group-hover/clear:opacity-100 group-has-[:focus-visible]/clear:opacity-100 pointer-coarse:opacity-100"
        />
      )}
    </div>
  );
}

/** The part of a `ClearableTrigger`'s button the X takes the place of while `clearable`. */
export function SwapOut({ clearable, children }: { clearable: boolean; children: ReactNode }) {
  return <span className={cn("inline-flex", clearable && SWAPPED_OUT)}>{children}</span>;
}

/**
 * A dropdown button's up and down arrows, which the clear X takes the place of while `clearable`.
 * `className` is for the arrows only while there's no X, such as hiding them on phones.
 */
export function TriggerArrows({
  clearable,
  className,
}: {
  clearable: boolean;
  className?: string;
}) {
  return (
    <ChevronsUpDown aria-hidden className={cn("opacity-50", clearable ? SWAPPED_OUT : className)} />
  );
}
