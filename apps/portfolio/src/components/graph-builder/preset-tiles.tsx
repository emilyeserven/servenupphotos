import { Check, X } from "lucide-react";
import { settingsCaption } from "@/components/graph-builder/preset-settings";
import { PresetThumbnail } from "@/components/graph-builder/preset-thumbnail";
import { Button } from "@/components/ui/button";
import type { GraphConfig } from "@/lib/graph-data";
import { type GraphPreset, presetIsOn } from "@/lib/graph-presets";
import type { Photo } from "@/lib/photos";
import type { SavedGraphs } from "@/lib/saved-graphs";

interface TilesProps {
  presets: GraphPreset[];
  /** The graph's settings, which the preset's are laid over and checked against. */
  config: GraphConfig;
  /** The photos the filters keep, which each thumbnail draws. */
  list: Photo[];
  /** Picking a preset: the graph takes its settings, and the filters stay as they are. */
  onPick: (change: Partial<GraphConfig>) => void;
  /** Pointing at a preset, or away from them all, for the (i) pane. */
  onPoint: (preset: GraphPreset | undefined) => void;
  /** The visitor's own presets, when these are theirs, so each tile gets an X to remove it. */
  saved?: SavedGraphs;
}

/**
 * The chosen group's presets as a gallery of tiles: each a small drawing of its graph from the
 * photos the filters keep, its name, checked while the graph is set as it, and a line saying what
 * it shows. Two to a row on phones, more beside them.
 */
export function PresetTiles({ presets, onPoint, ...props }: TilesProps) {
  return (
    <div
      className="grid grid-cols-2 gap-2 px-1 pb-1 sm:grid-cols-3 lg:grid-cols-4"
      onMouseLeave={() => onPoint(undefined)}
    >
      {presets.map((preset) => (
        <div
          key={preset.id}
          className="relative"
          onMouseEnter={() => onPoint(preset)}
          onFocus={() => onPoint(preset)}
        >
          <PresetTile {...props} preset={preset} />
          {props.saved && <RemoveButton preset={preset} saved={props.saved} />}
        </div>
      ))}
    </div>
  );
}

/** One preset's tile, which picks it. */
function PresetTile({
  preset,
  config,
  list,
  onPick,
}: Omit<TilesProps, "presets" | "onPoint" | "saved"> & { preset: GraphPreset }) {
  const full = { ...config, ...preset.graph };
  // While it's pressed (the graph is set as it), its frame, check and bolder name show, and its
  // drawing is at full strength: styled by `aria-pressed` so the tile has one look for each.
  return (
    <button
      type="button"
      aria-pressed={presetIsOn(preset, config)}
      onClick={() => onPick(preset.graph)}
      className="group flex h-full w-full flex-col gap-1.5 rounded-md border border-transparent p-1.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-border aria-pressed:bg-accent/60"
    >
      <div className="opacity-75 group-hover:opacity-100 group-aria-pressed:opacity-100">
        <PresetThumbnail list={list} config={full} />
      </div>
      <span className="flex min-w-0 items-start gap-1 text-sm group-aria-pressed:font-medium">
        <Check aria-hidden className="mt-0.5 hidden size-4 shrink-0 group-aria-pressed:block" />
        <span className="line-clamp-2">{preset.name}</span>
      </span>
      <span className="line-clamp-3 text-xs text-muted-foreground">
        {preset.description || settingsCaption(full)}
      </span>
    </button>
  );
}

/** The X that removes one of the visitor's own presets, over its thumbnail's corner. */
function RemoveButton({ preset, saved }: { preset: GraphPreset; saved: SavedGraphs }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Remove ${preset.name}`}
      title="Remove this preset"
      onClick={() => saved.remove(preset.id)}
      className="absolute top-2.5 right-2.5 size-6 bg-card/80"
    >
      <X aria-hidden />
    </Button>
  );
}
