import { useState } from "react";
import { PresetSettings } from "@/components/graph-builder/preset-settings";
import { PresetTiles } from "@/components/graph-builder/preset-tiles";
import { InfoButton } from "@/components/info-button";
import { SectionPicker } from "@/components/section-picker";
import type { GraphConfig } from "@/lib/graph-data";
import {
  type GraphPreset,
  type PresetSection,
  presetIsOn as isOn,
  presetSections,
} from "@/lib/graph-presets";
import type { Photo } from "@/lib/photos";
import type { SavedGraphs } from "@/lib/saved-graphs";

/** Picking a preset: the graph takes its settings, and the filters stay as they are. */
type OnPick = (change: Partial<GraphConfig>) => void;

/** What the visitor's own presets are called in the picker's list. */
const YOURS = "yours";

/** The picker's sections: the site's groups, then the visitor's own presets when they have any. */
function sectionsOf(saved: SavedGraphs): PresetSection[] {
  const site = presetSections();
  if (saved.presets.length === 0) return site;
  return [...site, { id: YOURS, name: "Yours", presets: saved.presets }];
}

/** What a section says it's set to: the preset the graph is set as, or how many it has. */
function sectionText(section: PresetSection, config: GraphConfig): string {
  return onIn(section, config)?.name ?? `${section.presets.length} presets`;
}

interface PickerProps {
  config: GraphConfig;
  /** The photos the filters keep, which each preset's thumbnail draws. */
  list: Photo[];
  saved: SavedGraphs;
  onPick: OnPick;
}

/**
 * The Presets tab's insides, like the Grid's **Groups** picker: the preset groups on the left (the
 * presets in no group as Other, and the visitor's own as Yours), and the chosen group's presets on
 * the right as tiles, each with a small drawing of its graph and a line saying what it shows;
 * picking one sets the graph to it. The (i) button adds a panel further right with the
 * settings of the preset pointed at, or the one the graph is set as.
 */
export function PresetPicker(props: PickerProps) {
  const [info, setInfo] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border">
      <PickerBody {...props} info={info} onInfo={() => setInfo(!info)} />
    </div>
  );
}

/** The first section with the preset the graph is set as, or the first one. */
function firstOn(sections: PresetSection[], config: GraphConfig): string {
  const on = sections.find((section) => section.presets.some((preset) => isOn(preset, config)));
  return (on ?? sections[0])?.id ?? "";
}

/** The picker's insides, from the section with the preset the graph is set as; a note when there are no presets. */
function PickerBody(props: PickerProps & { info: boolean; onInfo: () => void }) {
  const sections = sectionsOf(props.saved);
  const [key, setKey] = useState(() => firstOn(sections, props.config));
  const section = sections.find((each) => each.id === key) ?? sections[0];
  if (!section) return <p className="p-3 text-sm text-muted-foreground">No presets yet.</p>;
  return <PickerPanels {...props} sections={sections} section={section} onSection={setKey} />;
}

interface PanelsProps extends PickerProps {
  sections: PresetSection[];
  section: PresetSection;
  onSection: (id: string) => void;
  info: boolean;
  onInfo: () => void;
}

/**
 * The groups on the left and the chosen one's presets beside them (see `SectionPicker`), with the
 * settings of the preset pointed at, or the one the graph is set as, in the picker's panel to the
 * right while (i) is on.
 */
function PickerPanels({ sections, section, onSection, ...props }: PanelsProps) {
  const { config, info, onInfo } = props;
  const [pointed, setPointed] = useState<GraphPreset | undefined>();
  return (
    <SectionPicker
      label="Preset groups"
      sections={sections.map((each) => ({
        key: each.id,
        label: each.name,
        text: sectionText(each, config),
      }))}
      chosen={section.id}
      onChoose={onSection}
      width="w-full"
      fit
      aside={
        info ? (
          <SettingsPanel config={config} preset={pointed ?? onIn(section, config)} />
        ) : undefined
      }
    >
      <div className="-m-2 flex flex-col gap-1">
        <PanelHeader name={section.name} info={info} onInfo={onInfo} />
        <PresetTiles
          presets={section.presets}
          config={config}
          list={props.list}
          onPick={props.onPick}
          onPoint={setPointed}
          saved={section.id === YOURS ? props.saved : undefined}
        />
      </div>
    </SectionPicker>
  );
}

/** The section's preset the graph is set as, if any. */
function onIn(section: PresetSection, config: GraphConfig): GraphPreset | undefined {
  return section.presets.find((preset) => isOn(preset, config));
}

/** The settings of the preset pointed at or the graph is set as. */
function SettingsPanel({ config, preset }: { config: GraphConfig; preset?: GraphPreset }) {
  return <PresetSettings name={preset?.name} config={preset && { ...config, ...preset.graph }} />;
}

/** The presets panel's heading, with the (i) button that shows or hides their settings. */
function PanelHeader({ name, info, onInfo }: { name: string; info: boolean; onInfo: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-1">
      <span className="text-xs font-medium text-muted-foreground">{name}</span>
      <InfoButton open={info} label="preset settings" onClick={onInfo} />
    </div>
  );
}
