import { useState } from "react";
import { Slider } from "@portfolio/components/ui/slider";

/** The range a slider kept in the URL can be set in: its least, its most, and the step between. */
export interface SliderRange {
  min: number;
  max: number;
  step: number;
}

/**
 * A labeled slider for a number kept in the URL. It shows the value while it's dragged and only
 * calls onCommit when it's let go, so the URL changes once rather than on every step.
 */
export function SearchSlider({
  id,
  value,
  range,
  label,
  onCommit,
}: {
  /** The id its label gets, for screen readers. */
  id: string;
  value: number;
  range: SliderRange;
  /** The label beside it, given the value shown. */
  label: (shown: number) => React.ReactNode;
  onCommit: (value: number) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? value;
  return (
    <div className="flex w-full max-w-sm items-center gap-3 text-sm">
      <span id={id} className="whitespace-nowrap text-muted-foreground">
        {label(shown)}
      </span>
      <Slider
        aria-labelledby={id}
        {...range}
        value={[shown]}
        onValueChange={([next]) => setDragging(next ?? null)}
        onValueCommit={([next]) => {
          setDragging(null);
          if (next !== undefined) onCommit(next);
        }}
        className="py-1"
      />
    </div>
  );
}

/** A number from the URL, when it's a whole step within range that the slider can set. */
export function parseSliderValue(
  value: unknown,
  { min, max, step }: SliderRange,
): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && inRange(n, min, max) && (n - min) % step === 0 ? n : undefined;
}

/** Whether n is from min to max. */
function inRange(n: number, min: number, max: number): boolean {
  return n >= min && n <= max;
}
