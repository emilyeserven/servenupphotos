import type { ReactNode } from "react";
import type { WheelPoint } from "@/lib/color-wheel";
import { centerOn, type WheelView } from "@/lib/use-wheel-zoom";
import { cn } from "@/lib/utils";

/**
 * The whole color wheel (or Black & white chart), small, with a dot for each photo and a box
 * around the part that's in view, for finding your way when zoomed in. Clicking it moves the view
 * there.
 */
export function WheelMinimap({
  view,
  points,
  aspect,
  background,
  onChange,
  className,
}: {
  view: WheelView;
  /** Where each photo's place is, as fractions of the board's width and height. */
  points: WheelPoint[];
  /** The board's height over its width: 1 for the wheel. */
  aspect: number;
  /** What the board draws under its pins, drawn here too. */
  background: ReactNode;
  onChange: (view: WheelView) => void;
  className?: string;
}) {
  const size = 1 / view.zoom;
  return (
    <button
      type="button"
      aria-label="Move the view to here on the whole board"
      title="Where the view is on the whole board; click to move it"
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const at = {
          x: (event.clientX - box.left) / box.width,
          y: (event.clientY - box.top) / box.height,
        };
        onChange(centerOn(view, at));
      }}
      className={cn(
        "relative block w-24 cursor-pointer overflow-hidden border-2 border-background bg-background shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-28",
        className,
      )}
      style={{ aspectRatio: 1 / aspect }}
    >
      {background}
      {points.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute size-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/50"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        />
      ))}
      <span
        aria-hidden
        className="absolute rounded-sm border-2 border-foreground bg-foreground/10"
        style={{
          left: `${(view.x - size / 2) * 100}%`,
          top: `${(view.y - size / 2) * 100}%`,
          width: `${size * 100}%`,
          height: `${size * 100}%`,
        }}
      />
    </button>
  );
}
