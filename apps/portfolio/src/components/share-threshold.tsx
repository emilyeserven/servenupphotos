import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";

/** The least a hue's share can be set to, the most, and the step between, in percent. */
const MIN = 5;
const MAX = 95;
const STEP = 5;

/**
 * A slider for how much of a photo's colors a hue needs for the photo to show under it, kept in
 * the URL as `?min=` (left out at the default) so a link keeps it.
 */
export function ShareThreshold({ percent, fallback }: { percent: number; fallback: number }) {
  const navigate = useNavigate({ from: "/color" });
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? percent;
  return (
    <div className="flex w-full max-w-md items-center gap-3 text-sm">
      <span id="share-threshold" className="whitespace-nowrap text-muted-foreground">
        At least <span className="font-medium text-foreground tabular-nums">{shown}%</span> of the
        colors
      </span>
      <Slider
        aria-labelledby="share-threshold"
        min={MIN}
        max={MAX}
        step={STEP}
        value={[shown]}
        onValueChange={([next]) => setDragging(next ?? null)}
        onValueCommit={([next]) => {
          setDragging(null);
          const min = next === fallback ? undefined : next;
          void navigate({ search: (prev) => ({ ...prev, min, photo: undefined }), replace: true });
        }}
        className="py-1"
      />
    </div>
  );
}

/** The `?min=` from the URL, when it's a whole percent the slider can set. */
export function parseThreshold(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n >= MIN && n <= MAX ? n : undefined;
}
