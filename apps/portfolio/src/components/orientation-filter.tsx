import { Check } from "lucide-react";
import { ORIENTATIONS, type Orientation } from "@portfolio/lib/orientation";
import { cn } from "@portfolio/lib/utils";

/** A frame's size in the shape's 32 × 32 drawing, centered in it. */
interface Frame {
  width: number;
  height: number;
}

/** Each orientation's name, and the frame drawn for it. */
const ORIENTATION: Record<Orientation, { label: string; frame: Frame }> = {
  horizontal: { label: "Horizontal", frame: { width: 30, height: 20 } },
  vertical: { label: "Vertical", frame: { width: 20, height: 30 } },
  square: { label: "Square", frame: { width: 25, height: 25 } },
};

/**
 * The **Orientation** filter in the Visuals picker: a list of Horizontal, Vertical and Square,
 * each drawn as a frame of its proportions with a little person standing in it, with how many of the photos the other filters
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
  const { label } = ORIENTATION[value];
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
      <FrameShape frame={ORIENTATION[value].frame} on={on} />
      <span>{label}</span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}

/**
 * A photo frame of the orientation's proportions with a little person standing at its bottom, so
 * the shape reads as a photo, filled in while it's chosen.
 */
function FrameShape({ frame: { width, height }, on }: { frame: Frame; on: boolean }) {
  const x = (32 - width) / 2;
  const y = (32 - height) / 2;
  const bottom = y + height;
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={cn("size-9 shrink-0", on ? "text-foreground" : "text-muted-foreground")}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={2}
        fill="currentColor"
        fillOpacity={on ? 0.15 : 0}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <circle cx={16} cy={bottom - 11} r={3} fill="currentColor" />
      <path d={`M10 ${bottom - 1.5} a6 6 0 0 1 12 0 z`} fill="currentColor" />
    </svg>
  );
}
