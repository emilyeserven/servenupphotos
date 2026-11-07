import { useState } from "react";
import { graphPresetFiles } from "@/api/graph-presets";
import type { CombinedData } from "@/api/photos";
import { GroupEditor } from "@/components/graph-presets/group-editor";
import {
  type Chosen,
  NEW_GROUP,
  NEW_PRESET,
  PresetList,
} from "@/components/graph-presets/preset-list";
import { PresetEditor } from "@/components/graph-presets/preset-editor";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { useCombinedData } from "@/stores/combined-data";
import type { GraphPresetFile } from "@portfolio/lib/graph-presets";

/** The Graph Presets page: the ready-made graphs and preset groups on the portfolio's Graph page. */
export function GraphPresetsPage() {
  return (
    <Page
      wide
      title="Graph Presets"
      description="The ready-made graphs over the portfolio's Graph page, such as a dot graph of Aperture. The Graph page's Presets picker lists them by group, and a spotlight preset also gets its own button. Each preset and group is one JSON file, combined into GRAPHS.json."
    >
      <GitHubGate>{() => <Presets />}</GitHubGate>
    </Page>
  );
}

function Presets() {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the graph presets…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <PresetChooser data={combined.data} />;
}

/** The presets and groups listed on the left, in the Graph page's order, and the chosen one edited on the right. */
function PresetChooser({ data }: { data: CombinedData }) {
  const files = graphPresetFiles(data);
  const [chosen, setChosen] = useState<Chosen>(() => firstChoice(files));
  const file = files.find((f) => f.id === chosen);
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <PresetList files={files} chosen={chosen} onChoose={setChosen} />
      <ChosenEditor key={chosen} chosen={chosen} file={file} files={files} onSaved={setChosen} />
    </div>
  );
}

/** What's chosen when the page opens: the first preset or group, or a new preset when there's none. */
function firstChoice(files: GraphPresetFile[]): Chosen {
  return files[0]?.id ?? NEW_PRESET;
}

interface ChosenEditorProps {
  chosen: Chosen;
  /** The saved preset or group chosen; undefined for a new one. */
  file?: GraphPresetFile;
  files: GraphPresetFile[];
  onSaved: (id: string) => void;
}

/** The group editor for a group or a new one, and otherwise the preset editor. */
function ChosenEditor({ chosen, file, files, onSaved }: ChosenEditorProps) {
  const isGroup = file ? file.kind === "group" : chosen === NEW_GROUP;
  if (isGroup) return <GroupEditor group={file} files={files} onSaved={onSaved} />;
  return <PresetEditor preset={file} files={files} onSaved={onSaved} />;
}
