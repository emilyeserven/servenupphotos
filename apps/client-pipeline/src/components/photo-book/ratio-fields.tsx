import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomLayout } from "@/lib/photo-book";

/** A photo ratio, width to height. */
type Ratio = NonNullable<CustomLayout["ratio"]>;

/** Common photo ratios to pick with one click. */
const PRESETS: Ratio[] = [
  { width: 4, height: 5 },
  { width: 5, height: 4 },
  { width: 4, height: 3 },
  { width: 3, height: 4 },
  { width: 16, height: 9 },
  { width: 9, height: 16 },
  { width: 2, height: 1 },
];

/** The side typed, or 0 for one that isn't a number from more than 0 to 100. */
function sideOf(text: string): number {
  const n = Number(text);
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : 0;
}

/**
 * A layout's own photo ratio: its width and height typed in, such as 4 and 5, or one of the
 * common ratios picked. A side that isn't a number from more than 0 to 100 isn't saved.
 */
export function RatioFields(props: { ratio: Ratio; onChange: (ratio: Ratio) => void }) {
  const { ratio, onChange } = props;
  const [picked, setPicked] = useState(0);
  const set = (change: Partial<Ratio>) => {
    const next = { ...ratio, ...change };
    if (next.width > 0 && next.height > 0) onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <div key={picked} className="flex items-center gap-2">
        <Input
          type="number"
          aria-label="Photo ratio width"
          min={0}
          max={100}
          step="any"
          defaultValue={ratio.width}
          onChange={(event) => set({ width: sideOf(event.target.value) })}
          className="h-8 w-20"
        />
        <span className="text-muted-foreground text-sm">:</span>
        <Input
          type="number"
          aria-label="Photo ratio height"
          min={0}
          max={100}
          step="any"
          defaultValue={ratio.height}
          onChange={(event) => set({ height: sideOf(event.target.value) })}
          className="h-8 w-20"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <Button
            key={`${preset.width}:${preset.height}`}
            size="xs"
            variant="ghost"
            onClick={() => {
              onChange(preset);
              setPicked(picked + 1);
            }}
          >
            {preset.width}:{preset.height}
          </Button>
        ))}
      </div>
    </div>
  );
}
