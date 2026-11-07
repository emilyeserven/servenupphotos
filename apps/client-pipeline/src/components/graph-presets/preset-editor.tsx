import { useState } from "react";
import { lastOrder, newPresetId } from "@/api/graph-presets";
import { EditorButtons, Field, NameAndOrder } from "@/components/graph-presets/editor-parts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraphControls } from "@portfolio/components/graph-builder/graph-controls";
import type { GraphConfig } from "@portfolio/lib/graph-data";
import type { GraphPresetFile, PresetGraph, SavedGraph } from "@portfolio/lib/graph-presets";
import { NO_RANGES } from "@portfolio/lib/graph-ranges";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";

/** A new preset's graph, as the Graph page starts: photos per year, split by season. */
const START_GRAPH: PresetGraph = {
  type: "bar",
  x: "year",
  measure: "count",
  y: "season",
  split: "season",
  stacked: true,
  sort: "reverse",
  limit: 0,
  ...NO_RANGES,
};

/** The settings a preset keeps, in the order its file writes them. */
const GRAPH_KEYS = [
  "type",
  "x",
  "measure",
  "y",
  "split",
  "stacked",
  "sort",
  "limit",
  ...(Object.keys(NO_RANGES) as (keyof typeof NO_RANGES)[]),
] as const;

/** The graph's settings without its filters, which a preset leaves as they are. */
function presetGraph(config: PresetGraph): PresetGraph {
  return Object.fromEntries(GRAPH_KEYS.map((key) => [key, config[key]])) as unknown as PresetGraph;
}

/** Whether a setting is a Range group part that's off, which the file leaves out. */
function isOff([key, value]: [string, unknown]): boolean {
  return key in NO_RANGES && NO_RANGES[key as keyof typeof NO_RANGES] === value;
}

/** The graph as the preset's file keeps it, with the Range group's parts that are off left out. */
function savedGraph(graph: PresetGraph): SavedGraph {
  const kept = Object.entries(presetGraph(graph)).filter((entry) => !isOff(entry));
  return Object.fromEntries(kept) as SavedGraph;
}

/** The preset as typed. */
interface PresetDraft {
  name: string;
  /** The group's ID, or "" for none. */
  group: string;
  order: number;
  graph: PresetGraph;
}

/** A new preset's draft, last in the row. */
function newDraft(files: GraphPresetFile[]): PresetDraft {
  return { name: "", group: "", order: lastOrder(files), graph: START_GRAPH };
}

/** A saved preset's draft. */
function savedDraft(preset: GraphPresetFile): PresetDraft {
  const graph = { ...START_GRAPH, ...preset.graph };
  return { name: preset.name, group: preset.group ?? "", order: preset.order, graph };
}

/** The file the draft saves, keeping a saved preset's ID. */
function presetOf(
  draft: PresetDraft,
  files: GraphPresetFile[],
  saved?: GraphPresetFile,
): GraphPresetFile {
  const name = draft.name.trim();
  const file: GraphPresetFile = {
    id: saved?.id ?? newPresetId(name, files),
    kind: "preset",
    name,
    order: draft.order,
    graph: savedGraph(draft.graph),
  };
  return draft.group ? { ...file, group: draft.group } : file;
}

interface PresetEditorProps {
  /** The saved preset; undefined for a new one. */
  preset?: GraphPresetFile;
  /** Every saved preset and group. */
  files: GraphPresetFile[];
  onSaved: (id: string) => void;
}

/** Edits one graph preset, or a new one: its name, its group, where it sits, and the graph it sets. */
export function PresetEditor({ preset, files, onSaved }: PresetEditorProps) {
  const [draft, setDraft] = useState<PresetDraft>(() =>
    preset ? savedDraft(preset) : newDraft(files),
  );
  const set = (part: Partial<PresetDraft>) => setDraft({ ...draft, ...part });
  const config: GraphConfig = draft.graph;
  const next = presetOf(draft, files, preset);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{preset?.name ?? "New graph preset"}</CardTitle>
        <CardDescription>
          A button over the Graph page that sets the graph to these settings. The visitor's filters
          stay as they are.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <NameAndOrder name={draft.name} order={draft.order} placeholder="Aperture" onChange={set} />
        <GroupSelect value={draft.group} files={files} onChange={(group) => set({ group })} />
        <section aria-label="Graph settings" className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">The graph it sets</h3>
          <GraphControls
            config={config}
            onChange={(change) => set({ graph: presetGraph({ ...draft.graph, ...change }) })}
          />
        </section>
        <EditorButtons
          next={next}
          saved={preset}
          why={next.name === "" ? "Give it a name." : ""}
          onSaved={onSaved}
        />
      </CardContent>
    </Card>
  );
}

interface GroupSelectProps {
  value: string;
  files: GraphPresetFile[];
  onChange: (group: string) => void;
}

/** The preset group it's in, or none to show it as its own button. */
function GroupSelect({ value, files, onChange }: GroupSelectProps) {
  const groups = files.filter((file) => file.kind === "group");
  return (
    <Field label="Group">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
        <option value="">None, its own button</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
