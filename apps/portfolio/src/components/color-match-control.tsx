import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

/** The least a hue's share can be set to, the most, and the step between, in percent. */
const MIN = 5;
const MAX = 95;
const STEP = 5;

const MODES = [
  { match: undefined, label: "Largest color", title: "Photos whose biggest color is the hue" },
  { match: "threshold", label: "At least…", title: "Photos with at least a share of the hue" },
] as const;

/**
 * How a photo matches the picked hue: its largest color (the default), or at least a share of it
 * set on a slider. Both are kept in the URL, as `?match=threshold` and `?min=`, each left out at
 * its default, so a link keeps them.
 */
export function ColorMatchControl({
  threshold,
  percent,
  fallback,
}: {
  /** Whether the match is by share rather than the largest color. */
  threshold: boolean;
  percent: number;
  /** The share the slider starts at, which the URL leaves out. */
  fallback: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label="How photos match the color" className={CONTROL_FRAME}>
        {MODES.map(({ match, label, title }) => (
          <Link
            key={label}
            from="/color"
            to="/color"
            search={(prev) => ({ ...prev, match, photo: undefined })}
            replace
            aria-pressed={threshold === (match === "threshold")}
            title={title}
            className={controlButtonClass(threshold === (match === "threshold"))}
          >
            {label}
          </Link>
        ))}
      </div>
      {threshold && <ShareThreshold percent={percent} fallback={fallback} />}
    </div>
  );
}

/** A slider for how much of a photo's colors the hue needs, kept in the URL as `?min=`. */
function ShareThreshold({ percent, fallback }: { percent: number; fallback: number }) {
  const navigate = useNavigate({ from: "/color" });
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? percent;
  return (
    <div className="flex w-full max-w-sm items-center gap-3 text-sm">
      <span id="share-threshold" className="whitespace-nowrap text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{shown}%</span> of the colors
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
