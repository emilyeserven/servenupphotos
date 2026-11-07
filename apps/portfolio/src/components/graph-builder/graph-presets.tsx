import { Button } from "@/components/ui/button";
import type { GraphConfig } from "@/lib/graph-data";

/** The ready-made graphs: a dot for each value of a camera setting, at how many photos have it. */
const PRESETS: [string, string][] = [
  ["Aperture", "aperture"],
  ["Exposure", "exposure"],
  ["ISO", "iso"],
  ["Focal length", "focalLength"],
];

/** A preset's settings: a dot graph of the setting, lowest value first, unsplit, every value shown. */
function presetConfig(x: string): Partial<GraphConfig> {
  return { type: "dot", x, measure: "count", split: "", sort: "group", limit: 0 };
}

/**
 * Buttons for the ready-made graphs, each setting the graph to a dot graph of a camera setting,
 * such as one dot per aperture. The filters stay as they are.
 */
export function GraphPresets({ onPick }: { onPick: (change: Partial<GraphConfig>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Presets</span>
      {PRESETS.map(([label, x]) => (
        <Button
          key={x}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPick(presetConfig(x))}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
