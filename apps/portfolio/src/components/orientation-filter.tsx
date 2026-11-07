import { Check } from "lucide-react";
import { ORIENTATIONS, type Orientation } from "@portfolio/lib/orientation";
import { cn } from "@portfolio/lib/utils";

/** Each orientation's name, and the size of the shape drawn for it, in Tailwind units. */
const ORIENTATION: Record<Orientation, { label: string; shape: string }> = {
  horizontal: { label: "Horizontal", shape: "h-4 w-6" },
  vertical: { label: "Vertical", shape: "h-6 w-4" },
  square: { label: "Square", shape: "size-5" },
};

/**
 * The **Orientation** filter in the Visuals picker: a list of Horizontal, Vertical and Square,
 * each drawn as an outlined shape of its proportions, with how many of the photos the other filters
 * leave have it. Clicking the chosen one again clears it.
 */
export function OrientationFilter({
  orientation,
  counts,
  onChange,
}: {
  orientation: string | undefined;
  counts: Record<Orientation, number>;
  onChange: (orientation: Orientation | undefined) => void;
}) {
  return (
    <div role="group" aria-label="Orientation" className="flex flex-col">
      {ORIENTATIONS.map((value) => (
        <OrientationRow
          key={value}
          value={value}
          count={counts[value]}
          on={orientation === value}
          onClick={(on) => onChange(on ? undefined : value)}
        />
      ))}
    </div>
  );
}

/** One orientation: a check while it's chosen, its shape, its name and its count. */
function OrientationRow({
  value,
  count,
  on,
  onClick,
}: {
  value: Orientation;
  count: number;
  on: boolean;
  onClick: (on: boolean) => void;
}) {
  const { label, shape } = ORIENTATION[value];
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onClick(on)}
      className={cn(
        "flex items-center gap-3 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent",
        on && "font-medium",
      )}
    >
      <Check aria-hidden className={cn("size-4 shrink-0", !on && "invisible")} />
      <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
        <span
          className={cn(
            "rounded-[3px] border-2",
            shape,
            on ? "border-foreground bg-foreground/15" : "border-muted-foreground",
          )}
        />
      </span>
      <span>{label}</span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}
