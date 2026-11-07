import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GraphConfig } from "@/lib/graph-data";
import { spotlightPresets } from "@/lib/graph-presets";

/** Picking a preset: the graph takes its settings, and the filters stay as they are. */
type OnPick = (change: Partial<GraphConfig>) => void;

/** The presets the pipeline spotlights, each its own button above the Presets; nothing when there are none. */
export function SpotlightPresets({ onPick }: { onPick: OnPick }) {
  const presets = spotlightPresets();
  if (presets.length === 0) return null;
  return (
    <div role="group" aria-label="Spotlight presets" className="flex flex-wrap items-center gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.id}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPick(preset.graph)}
        >
          <Star className="text-muted-foreground" aria-hidden />
          {preset.name}
        </Button>
      ))}
    </div>
  );
}
