import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GraphConfig } from "@/lib/graph-data";
import { type GraphPreset, presetIsOn, spotlightPresets } from "@/lib/graph-presets";

/** Picking a preset: the graph takes its settings, and the filters stay as they are. */
type OnPick = (change: Partial<GraphConfig>) => void;

/**
 * The presets the pipeline spotlights, each its own button above the Presets, with the one the
 * graph is set as checked off; nothing when there are none.
 */
export function SpotlightPresets({ config, onPick }: { config: GraphConfig; onPick: OnPick }) {
  const presets = spotlightPresets();
  if (presets.length === 0) return null;
  return (
    <div role="group" aria-label="Spotlight presets" className="flex flex-wrap items-center gap-2">
      {presets.map((preset) => (
        <SpotlightButton
          key={preset.id}
          preset={preset}
          on={presetIsOn(preset, config)}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

/** One spotlight preset's button: a check while the graph is set as it, else a star. */
function SpotlightButton({
  preset,
  on,
  onPick,
}: {
  preset: GraphPreset;
  on: boolean;
  onPick: OnPick;
}) {
  const Icon = on ? Check : Star;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={on ? "bg-accent text-accent-foreground" : undefined}
      aria-pressed={on}
      onClick={() => onPick(preset.graph)}
    >
      <Icon className={on ? undefined : "text-muted-foreground"} aria-hidden />
      {preset.name}
    </Button>
  );
}
