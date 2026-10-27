import type { Focus } from "@/lib/spotlight-focus";
import { cn } from "@/lib/utils";

/** The spots the focus point can be put on the screen, by row and then by column. */
const SPOTS = [20, 50, 80].flatMap((y) => [20, 50, 80].map((x) => ({ x, y })));

/** What a spot is called, such as "Bottom left" or "Middle". */
function spotName({ x, y }: Focus): string {
  const row = { 20: "Top", 50: "", 80: "Bottom" }[y] ?? "";
  const column = { 20: "left", 50: "", 80: "right" }[x] ?? "";
  return [row, column].filter(Boolean).join(" ") || "Middle";
}

/** Whether placement is at the spot; no placement is the middle. */
function isAt(placement: Focus | null, spot: Focus): boolean {
  const at = placement ?? { x: 50, y: 50 };
  return at.x === spot.x && at.y === spot.y;
}

interface SpotlightPlacementProps {
  placement: Focus | null;
  /** Called with the spot picked, or null for the middle. */
  onPick: (placement: Focus | null) => void;
}

/**
 * Where on the screen a spotlight zone puts the photo's focus point: a three by three grid of
 * spots, the middle by default, such as the bottom middle to have it low on the screen. The crop
 * gets as near as the photo's edges allow.
 */
export function SpotlightPlacement({ placement, onPick }: SpotlightPlacementProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        role="group"
        aria-label="Where the focus point goes on the screen"
        className="grid w-20 shrink-0 grid-cols-3 gap-1 rounded-md border p-1"
      >
        {SPOTS.map((spot) => (
          <SpotButton
            key={`${spot.x}-${spot.y}`}
            spot={spot}
            on={isAt(placement, spot)}
            onPick={onPick}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-sm">
        On the screen, the focus point goes to the{" "}
        <strong className="text-foreground">
          {spotName(placement ?? { x: 50, y: 50 }).toLowerCase()}
        </strong>
        , or as near as the photo&apos;s edges allow.
      </p>
    </div>
  );
}

interface SpotButtonProps {
  spot: Focus;
  on: boolean;
  onPick: (placement: Focus | null) => void;
}

/** One spot of the grid, filled in when it's picked. */
function SpotButton({ spot, on, onPick }: SpotButtonProps) {
  const middle = spot.x === 50 && spot.y === 50;
  return (
    <button
      type="button"
      aria-label={spotName(spot)}
      aria-pressed={on}
      title={spotName(spot)}
      onClick={() => onPick(middle ? null : spot)}
      className="hover:bg-muted grid aspect-square place-items-center rounded-sm"
    >
      <span
        className={cn(
          "size-2 rounded-full border",
          on ? "border-primary bg-primary" : "border-muted-foreground/50",
        )}
      />
    </button>
  );
}
