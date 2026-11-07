import type { CSSProperties } from "react";
import { storedValue } from "@portfolio/lib/stored-value";
import type { CropLimits } from "@/lib/gear-crop";
import { Input } from "@/components/ui/input";

/** A side of the crop frame. */
type Side = "top" | "bottom" | "left" | "right";

/** The sides, in the order their fields are listed, with their names. */
const SIDES: [Side, string][] = [
  ["top", "Top"],
  ["bottom", "Bottom"],
  ["left", "Left"],
  ["right", "Right"],
];

/** The furthest in a limit can be: just short of the frame's middle. */
const MOST = 49;

/** A limit saved as `stored`, kept from 0 (no line) to MOST, or 0 when it's not a number. */
function limitOf(stored: unknown): number {
  return typeof stored === "number" && Number.isFinite(stored)
    ? Math.min(MOST, Math.max(0, stored))
    : 0;
}

/** The limits saved in this browser, any side missing or unreadable being 0. */
function readLimits(stored: unknown): CropLimits {
  const saved = (stored ?? {}) as Partial<Record<Side, unknown>>;
  return {
    top: limitOf(saved.top),
    bottom: limitOf(saved.bottom),
    left: limitOf(saved.left),
    right: limitOf(saved.right),
  };
}

/** The crop frame's limit lines, remembered in this browser for every camera and lens. */
export const cropLimits = storedValue("servenup-gear-crop-limits", readLimits);

/** Where a side's limit line sits in the frame, and how its outside is shaded. */
const LINE_PLACES: Record<Side, (inset: string) => CSSProperties> = {
  top: (inset) => ({ left: 0, right: 0, top: 0, height: inset, borderBottomWidth: 1 }),
  bottom: (inset) => ({ left: 0, right: 0, bottom: 0, height: inset, borderTopWidth: 1 }),
  left: (inset) => ({ top: 0, bottom: 0, left: 0, width: inset, borderRightWidth: 1 }),
  right: (inset) => ({ top: 0, bottom: 0, right: 0, width: inset, borderLeftWidth: 1 }),
};

/**
 * The limit lines in the crop frame, one in from each side that has a limit, with the space past
 * them lightly shaded, to fit each picture inside.
 */
export function CropLimitLines() {
  const limits = cropLimits.use();
  return SIDES.filter(([side]) => limits[side] > 0).map(([side]) => (
    <div
      key={side}
      aria-hidden
      className="pointer-events-none absolute z-20 border-0 border-rose-500 bg-rose-500/10"
      style={LINE_PLACES[side](`${limits[side]}%`)}
    />
  ));
}

/** Fields for how far in each side's limit line is, saved in this browser as they change. */
export function CropLimitFields() {
  const limits = cropLimits.use();
  return (
    <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <legend className="sr-only">Limits</legend>
      <span className="text-muted-foreground">Limits (% in from each side)</span>
      {SIDES.map(([side, label]) => (
        <label key={side} className="flex items-center gap-1">
          <span className="text-muted-foreground">{label}</span>
          <Input
            type="number"
            min={0}
            max={MOST}
            value={limits[side]}
            className="h-7 w-16 text-xs"
            onChange={(e) => cropLimits.set({ ...limits, [side]: limitOf(Number(e.target.value)) })}
          />
        </label>
      ))}
    </fieldset>
  );
}
