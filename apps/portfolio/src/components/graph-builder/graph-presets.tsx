import { ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { SavedPresets, SavePresetButton } from "@/components/graph-builder/saved-presets";
import { Button } from "@/components/ui/button";
import type { GraphConfig } from "@/lib/graph-data";
import { type GraphPreset, type PresetItem, presetRow } from "@/lib/graph-presets";
import { useSavedGraphs } from "@/lib/saved-graphs";

/** Picking a preset: the graph takes its settings, and the filters stay as they are. */
type OnPick = (change: Partial<GraphConfig>) => void;

/**
 * The row of ready-made graphs the pipeline's Graph Presets page saves, in their order: a button
 * for each preset, such as a dot graph of Aperture, and a dropdown for each preset group. Picking
 * one sets the graph to it; the filters stay as they are. After them come the visitor's own
 * presets, kept in their browser, and Save as preset to keep the graph as one.
 */
export function GraphPresets({ config, onPick }: { config: GraphConfig; onPick: OnPick }) {
  const saved = useSavedGraphs();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Presets</span>
      {presetRow().map((item) => (
        <RowItem key={itemKey(item)} item={item} onPick={onPick} />
      ))}
      <SavedPresets saved={saved} onPick={onPick} />
      <SavePresetButton saved={saved} config={config} />
    </div>
  );
}

/** What a row item is kept apart by: its preset's or group's ID. */
function itemKey(item: PresetItem): string {
  return item.kind === "preset" ? item.preset.id : `group:${item.id}`;
}

/** A preset's button, or a group's dropdown. */
function RowItem({ item, onPick }: { item: PresetItem; onPick: OnPick }) {
  if (item.kind === "group")
    return <PresetGroup name={item.name} presets={item.presets} onPick={onPick} />;
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => onPick(item.preset.graph)}>
      {item.preset.name}
    </Button>
  );
}

/** A preset group: a button with its name that opens a menu of its presets. */
function PresetGroup({
  name,
  presets,
  onPick,
}: {
  name: string;
  presets: GraphPreset[];
  onPick: OnPick;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="outline" size="sm">
          {name}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {presets.map((preset) => (
            <DropdownMenu.Item
              key={preset.id}
              onSelect={() => onPick(preset.graph)}
              className="cursor-default rounded-sm px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
            >
              {preset.name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
