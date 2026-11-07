import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { savePresetMutation } from "@/api/graph-presets";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { changeLines } from "@/components/graph-presets/group-change-lines";
import { fullGraph, presetChange, savedGraph } from "@/components/graph-presets/preset-graph";
import { Button } from "@/components/ui/button";
import { canonicalJson } from "@/lib/combined";
import { GraphControls } from "@portfolio/components/graph-builder/graph-controls";
import type { GraphPresetFile, PresetGraph } from "@portfolio/lib/graph-presets";

/** The preset with the change made over its graph, keeping its other settings. */
function changedPreset(preset: GraphPresetFile, change: Partial<PresetGraph>): GraphPresetFile {
  return { ...preset, graph: savedGraph({ ...fullGraph(preset.graph), ...change }) };
}

/** The presets the change makes different, each with the change made. */
function changedPresets(
  inside: GraphPresetFile[],
  change: Partial<PresetGraph>,
): GraphPresetFile[] {
  const changed = inside.map((preset) => changedPreset(preset, change));
  return changed.filter((preset, index) => canonicalJson(preset) !== canonicalJson(inside[index]));
}

/** Saves each preset in turn, each as a change waiting for Commit. */
function useSaveAll(onDone: () => void) {
  const save = useMutation(savePresetMutation);
  return useMutation({
    mutationFn: async (presets: GraphPresetFile[]) => {
      for (const preset of presets) await save.mutateAsync(preset);
    },
    onSuccess: onDone,
  });
}

/** What the change does, or why there's nothing to save. */
function whyNot(touched: boolean, count: number, already: string[]): string {
  if (!touched) return "Pick a setting above to change it in every preset.";
  if (count === 0) return "Every preset in the group has these settings already.";
  return alreadyNote(already);
}

/** Which presets the change leaves as they are, such as "Time of day has these already." */
function alreadyNote(names: string[]): string {
  if (names.length === 0) return "";
  return `${names.join(", ")} ${names.length === 1 ? "has" : "have"} these already.`;
}

/** The names of the presets in the group the change leaves as they are. */
function unchangedNames(inside: GraphPresetFile[], changed: GraphPresetFile[]): string[] {
  const ids = new Set(changed.map((preset) => preset.id));
  return inside.filter((preset) => !ids.has(preset.id)).map((preset) => preset.name);
}

/**
 * Changes some graph settings in every preset in a group at once, such as the graph type, picked
 * with the same buttons as a preset's editor. Only the settings picked here change; each preset
 * keeps its others.
 */
export function GroupSettings({ inside }: { inside: GraphPresetFile[] }) {
  const [change, setChange] = useState<Partial<PresetGraph>>({});
  const saveAll = useSaveAll(() => setChange({}));
  const shown = { ...fullGraph(inside[0]?.graph), ...change };
  const lines = changeLines(change, shown);
  const presets = changedPresets(inside, change);
  const first = inside[0];
  if (!first) return null;
  return (
    <section aria-label="Change every preset" className="flex flex-col gap-2 border-t pt-4">
      <h3 className="text-sm font-medium">Change every preset in it</h3>
      <p className="text-muted-foreground text-sm">
        The buttons start from {first.name}'s graph. Only the settings you pick change, in all{" "}
        {inside.length} presets; each keeps its others.
      </p>
      <GraphControls
        config={shown}
        onChange={(part) => setChange({ ...change, ...presetChange(part) })}
      />
      <ChangeList lines={lines} />
      <SaveRow
        presets={presets}
        already={unchangedNames(inside, presets)}
        touched={lines.length > 0}
        onSave={() => saveAll.mutate(presets)}
        onClear={() => setChange({})}
        saving={saveAll}
      />
    </section>
  );
}

/** The settings picked so far, each with what every preset will have. */
function ChangeList({ lines }: { lines: [string, string][] }) {
  if (lines.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
      {lines.map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-muted-foreground">{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface SaveRowProps {
  /** The presets the change makes different. */
  presets: GraphPresetFile[];
  /** The names of the presets that have the picked settings already. */
  already: string[];
  /** Whether any setting is picked yet. */
  touched: boolean;
  saving: { isPending: boolean; error: Error | null };
  onSave: () => void;
  onClear: () => void;
}

/** Saves the changed presets, with Start over once a setting is picked. */
function SaveRow({ presets, already, touched, saving, onSave, onClear }: SaveRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled={presets.length === 0 || saving.isPending} onClick={onSave}>
        <Busy busy={saving.isPending} />
        {saveText(presets.length)}
      </Button>
      {touched && (
        <Button variant="outline" onClick={onClear}>
          Start over
        </Button>
      )}
      <SaveNote error={saving.error} why={whyNot(touched, presets.length, already)} />
    </div>
  );
}

/** The save button's text, such as Save 3 presets. */
function saveText(count: number): string {
  return `Save ${count} ${count === 1 ? "preset" : "presets"}`;
}
