import { useState } from "react";
import { lastOrder, newPresetId } from "@/api/graph-presets";
import { EditorButtons, Field, NameAndOrder } from "@/components/graph-presets/editor-parts";
import { DescriptionField } from "@/components/graph-presets/description-field";
import {
  fullGraph,
  presetGraph,
  savedGraph,
  START_GRAPH,
} from "@/components/graph-presets/preset-graph";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraphControls } from "@portfolio/components/graph-builder/graph-controls";
import type { GraphConfig } from "@portfolio/lib/graph-data";
import type { GraphPresetFile, PresetGraph } from "@portfolio/lib/graph-presets";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";

/** The preset as typed. */
interface PresetDraft {
  name: string;
  /** The one-line caption under its name in the Graph page's Presets picker, or "" for one made from its settings. */
  description: string;
  /** The group's ID, or "" for none. */
  group: string;
  order: number;
  graph: PresetGraph;
  /** Whether it shows as its own button above the Graph page's Presets and Adjust Graph. */
  spotlight: boolean;
}

/** A new preset's draft, last in the row. */
function newDraft(files: GraphPresetFile[]): PresetDraft {
  return {
    name: "",
    description: "",
    group: "",
    order: lastOrder(files),
    graph: START_GRAPH,
    spotlight: false,
  };
}

/** A saved preset's draft. */
function savedDraft(preset: GraphPresetFile): PresetDraft {
  return {
    name: preset.name,
    description: preset.description ?? "",
    group: preset.group ?? "",
    order: preset.order,
    graph: fullGraph(preset.graph),
    spotlight: preset.spotlight === true,
  };
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
  return withExtras(file, draft);
}

/** The file with the draft's description, group and spotlight, each left out while it's empty or off. */
function withExtras(file: GraphPresetFile, draft: PresetDraft): GraphPresetFile {
  const { group, spotlight } = draft;
  const description = draft.description.trim();
  return {
    ...file,
    ...(description && { description }),
    ...(group && { group }),
    ...(spotlight && { spotlight }),
  };
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
        <DescriptionField
          value={draft.description}
          onChange={(description) => set({ description })}
        />
        <GroupSelect value={draft.group} files={files} onChange={(group) => set({ group })} />
        <SpotlightBox checked={draft.spotlight} onChange={(spotlight) => set({ spotlight })} />
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

/** The preset group it's in, or none to list it under Other. */
function GroupSelect({ value, files, onChange }: GroupSelectProps) {
  const groups = files.filter((file) => file.kind === "group");
  return (
    <Field label="Group">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
        <option value="">None, listed under Other</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Whether the preset shows as its own button above the Graph page's Presets and Adjust Graph. */
function SpotlightBox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (spotlight: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      <span>
        <span className="font-medium">Spotlight</span>
        <span className="text-muted-foreground">
          {" "}
          — show it as its own button above Presets and Adjust Graph
        </span>
      </span>
    </label>
  );
}
