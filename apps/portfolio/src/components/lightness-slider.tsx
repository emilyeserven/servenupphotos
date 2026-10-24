import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import type { CSSProperties } from "react";
import {
  LIGHTNESS_STEP,
  lightnessGray,
  lightnessParam,
  type LightnessRange,
} from "@/lib/lightness-range";

/**
 * The Black & white view's spectrum of grays across extent (the photos' range of lightness, the
 * chart's ends), with a handle at each end to narrow it to range, kept in the URL as
 * `?light=20-60` and left out for the whole extent. The URL only changes once a handle is let go.
 */
export function LightnessSlider({
  range,
  extent,
}: {
  range: LightnessRange;
  extent: LightnessRange;
}) {
  const navigate = useNavigate({ from: "/color" });
  const [dragging, setDragging] = useState<LightnessRange | null>(null);
  const [low, high] = dragging ?? range;
  return (
    <div className="flex flex-col gap-1">
      <Slider
        aria-label="Lightness"
        min={extent[0]}
        max={extent[1]}
        step={LIGHTNESS_STEP}
        minStepsBetweenThumbs={1}
        value={[low, high]}
        onValueChange={([a = extent[0], b = extent[1]]) => setDragging([a, b])}
        onValueCommit={([a = extent[0], b = extent[1]]) => {
          setDragging(null);
          void navigate({
            search: (prev) => ({
              ...prev,
              light: lightnessParam([a, b], extent),
              photo: undefined,
            }),
            replace: true,
          });
        }}
        style={{ "--grays": graysOf(extent) } as CSSProperties}
        className="py-2 [&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-range]]:ring-2 [&_[data-slot=slider-range]]:ring-sky-500 [&_[data-slot=slider-range]]:ring-inset [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-track]]:h-6 [&_[data-slot=slider-track]]:bg-(image:--grays) [&_[data-slot=slider-track]]:ring-1 [&_[data-slot=slider-track]]:ring-border"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{extent[0]}</span>
        <span className="tabular-nums">
          Lightness {low}–{high}
        </span>
        <span className="tabular-nums">{extent[1]}</span>
      </div>
    </div>
  );
}

/** The grays from one end of extent to the other, as a CSS gradient. */
export function graysOf([low, high]: LightnessRange): string {
  return `linear-gradient(to right, ${lightnessGray(low)}, ${lightnessGray(high)})`;
}
