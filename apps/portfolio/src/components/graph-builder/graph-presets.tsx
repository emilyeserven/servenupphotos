import { Star } from "lucide-react";
import type { ReactNode } from "react";
import { PresetPicker } from "@/components/graph-builder/preset-picker";
import { SavePresetButton } from "@/components/graph-builder/saved-presets";
import { Button } from "@/components/ui/button";
import type { GraphConfig } from "@/lib/graph-data";
import { spotlightPresets } from "@/lib/graph-presets";
import { useSavedGraphs } from "@/lib/saved-graphs";

/** Picking a preset: the graph takes its settings, and the filters stay as they are. */
type OnPick = (change: Partial<GraphConfig>) => void;

/**
 * The Graph page's row of buttons: **Presets**, which opens the ready-made graphs the pipeline's
 * Graph Presets page saves and the visitor's own, then `children` (the Adjust Graph button and the
 * Show filters bar), then, at the row's far end, Save as preset to keep the graph as one of the
 * visitor's own, in their browser.
 */
export function PresetButtons({
  config,
  onPick,
  children,
}: {
  config: GraphConfig;
  onPick: OnPick;
  children: ReactNode;
}) {
  const saved = useSavedGraphs();
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
        <PresetPicker config={config} saved={saved} onPick={onPick} />
        {children}
      </div>
      <SavePresetButton saved={saved} config={config} />
    </div>
  );
}

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
