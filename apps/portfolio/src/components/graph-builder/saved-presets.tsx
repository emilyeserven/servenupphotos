import { Bookmark, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { GraphConfig } from "@/lib/graph-data";
import type { PresetGraph } from "@/lib/graph-presets";
import type { SavedGraphs } from "@/lib/saved-graphs";
import { SELECT_CLASS } from "@/lib/segmented-control";

/** Picking a preset: the graph takes its settings, and the filters stay as they are. */
type OnPick = (change: Partial<GraphConfig>) => void;

/** The graph's settings a preset keeps: all but its filters. */
function presetGraph({ filters: _filters, ...graph }: GraphConfig): PresetGraph {
  return graph;
}

/** The visitor's own presets, each a button with a × to remove it, after the site's presets. */
export function SavedPresets({ saved, onPick }: { saved: SavedGraphs; onPick: OnPick }) {
  return saved.presets.map((preset) => (
    <span key={preset.id} className="inline-flex">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-r-none border-r-0"
        onClick={() => onPick(preset.graph)}
      >
        <Bookmark aria-hidden />
        {preset.name}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-l-none px-2"
        aria-label={`Remove ${preset.name}`}
        title="Remove this preset"
        onClick={() => saved.remove(preset.id)}
      >
        <X aria-hidden />
      </Button>
    </span>
  ));
}

/**
 * The Save as preset button: it asks for a name, then keeps the graph's settings (not its filters)
 * as one of the visitor's own presets, in their browser.
 */
export function SavePresetButton({ saved, config }: { saved: SavedGraphs; config: GraphConfig }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    saved.save(name.trim(), presetGraph(config));
    setName("");
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Bookmark aria-hidden />
          Save as preset
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Name
            <input
              value={name}
              placeholder="My graph"
              onChange={(e) => setName(e.target.value)}
              className={`${SELECT_CLASS} cursor-text`}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Kept in this browser only. The filters aren't saved with it.
          </p>
          <Button type="submit" size="sm" disabled={name.trim() === ""}>
            Save preset
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
