import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { LIGHTNESS_STEP, lightnessParam, type LightnessRange } from "@/lib/lightness-range";

/**
 * The Black & white view's spectrum from black to white, with a handle at each end to narrow it
 * to a range of lightness, kept in the URL as `?light=20-60` and left out for the whole spectrum.
 * The URL only changes once a handle is let go.
 */
export function LightnessSlider({ range }: { range: LightnessRange }) {
  const navigate = useNavigate({ from: "/color" });
  const [dragging, setDragging] = useState<LightnessRange | null>(null);
  const [low, high] = dragging ?? range;
  return (
    <div className="flex flex-col gap-1">
      <Slider
        aria-label="Lightness"
        min={0}
        max={100}
        step={LIGHTNESS_STEP}
        minStepsBetweenThumbs={1}
        value={[low, high]}
        onValueChange={([a = 0, b = 100]) => setDragging([a, b])}
        onValueCommit={([a = 0, b = 100]) => {
          setDragging(null);
          void navigate({
            search: (prev) => ({ ...prev, light: lightnessParam([a, b]), photo: undefined }),
            replace: true,
          });
        }}
        className="py-2 [&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-range]]:ring-2 [&_[data-slot=slider-range]]:ring-sky-500 [&_[data-slot=slider-range]]:ring-inset [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-track]]:h-6 [&_[data-slot=slider-track]]:bg-linear-to-r [&_[data-slot=slider-track]]:from-black [&_[data-slot=slider-track]]:to-white [&_[data-slot=slider-track]]:ring-1 [&_[data-slot=slider-track]]:ring-border"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Black</span>
        <span className="tabular-nums">
          Lightness {low}–{high}
        </span>
        <span>White</span>
      </div>
    </div>
  );
}
