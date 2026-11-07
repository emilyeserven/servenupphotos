import { Bookmark, ChevronsUpDown, Info, X } from "lucide-react";
import { useState } from "react";
import { ChoiceRow } from "@/components/choice-row";
import { PresetSettings } from "@/components/graph-builder/preset-settings";
import { SectionTab } from "@/components/picker-section-tab";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { GraphConfig } from "@/lib/graph-data";
import { type GraphPreset, type PresetSection, presetSections } from "@/lib/graph-presets";
import type { SavedGraphs } from "@/lib/saved-graphs";
import { cn } from "@/lib/utils";

/** Picking a preset: the graph takes its settings, and the filters stay as they are. */
type OnPick = (change: Partial<GraphConfig>) => void;

/** What the visitor's own presets are called in the picker's list. */
const YOURS = "yours";

/** Whether the graph is set as the preset sets it. */
function isOn(preset: GraphPreset, config: GraphConfig): boolean {
  return Object.entries(preset.graph).every(
    ([key, value]) => config[key as keyof GraphConfig] === value,
  );
}

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
  saved: SavedGraphs;
  onPick: OnPick;
}

/**
 * The **Presets** button, like the Grid's **Groups**: it opens a list of the preset groups on the
 * left (the presets in no group as Other, and the visitor's own as Yours), and the chosen group's
 * presets on the right; picking one sets the graph to it. The (i) button adds a panel further
 * right with the settings of the preset pointed at, or the one the graph is set as.
 */
export function PresetPicker(props: PickerProps) {
  const [info, setInfo] = useState(false);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="font-normal">
          <Bookmark className="text-muted-foreground" aria-hidden />
          Presets
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className={cn(
          "p-0",
          info ? "w-[min(46rem,calc(100vw-2rem))]" : "w-[min(32rem,calc(100vw-2rem))]",
        )}
      >
        <PickerBody {...props} info={info} onInfo={() => setInfo(!info)} />
      </PopoverContent>
    </Popover>
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

/** The list of sections, the chosen one's presets, and their settings while (i) is on. */
function PickerPanels({ sections, section, onSection, ...props }: PanelsProps) {
  const { config, info, onInfo } = props;
  const [pointed, setPointed] = useState<GraphPreset | undefined>();
  return (
    <div className="flex max-h-[min(28rem,calc(var(--radix-popover-content-available-height)-1rem))] flex-col sm:flex-row">
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Preset groups"
        className="flex shrink-0 flex-col gap-0.5 overflow-y-auto border-b bg-muted/40 p-1 sm:w-40 sm:border-r sm:border-b-0"
      >
        {sections.map((each) => (
          <SectionTab
            key={each.id}
            label={each.name}
            text={sectionText(each, config)}
            chosen={each.id === section.id}
            onClick={() => onSection(each.id)}
          />
        ))}
      </div>
      <div role="tabpanel" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-1">
        <PanelHeader name={section.name} info={info} onInfo={onInfo} />
        <PresetList {...props} section={section} onPoint={setPointed} />
      </div>
      {info && <SettingsPanel config={config} preset={pointed ?? onIn(section, config)} />}
    </div>
  );
}

/** The section's preset the graph is set as, if any. */
function onIn(section: PresetSection, config: GraphConfig): GraphPreset | undefined {
  return section.presets.find((preset) => isOn(preset, config));
}

/** The panel right of the presets with the settings of the one pointed at or the graph is set as. */
function SettingsPanel({ config, preset }: { config: GraphConfig; preset?: GraphPreset }) {
  return (
    <div className="min-w-0 shrink-0 border-t sm:w-56 sm:border-t-0 sm:border-l">
      <PresetSettings name={preset?.name} config={preset && { ...config, ...preset.graph }} />
    </div>
  );
}

/** The presets panel's heading, with the (i) button that shows or hides their settings. */
function PanelHeader({ name, info, onInfo }: { name: string; info: boolean; onInfo: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-1">
      <span className="text-xs font-medium text-muted-foreground">{name}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-pressed={info}
        aria-label={info ? "Hide preset settings" : "Show preset settings"}
        title={info ? "Hide preset settings" : "Show preset settings"}
        onClick={onInfo}
        className={cn("size-7", info && "bg-accent")}
      >
        <Info aria-hidden />
      </Button>
    </div>
  );
}

/** The section's presets, each picking itself, and the visitor's own each with an X to remove it. */
function PresetList({
  section,
  config,
  saved,
  onPick,
  onPoint,
}: PickerProps & {
  section: PresetSection;
  onPoint: (preset: GraphPreset | undefined) => void;
}) {
  return (
    <div className="flex flex-col" onMouseLeave={() => onPoint(undefined)}>
      {section.presets.map((preset) => (
        <div
          key={preset.id}
          className="flex items-center [&>button:first-child]:min-w-0 [&>button:first-child]:flex-1"
          onMouseEnter={() => onPoint(preset)}
          onFocus={() => onPoint(preset)}
        >
          <ChoiceRow
            label={preset.name}
            on={isOn(preset, config)}
            onClick={() => onPick(preset.graph)}
          />
          {section.id === YOURS && <RemoveButton preset={preset} saved={saved} />}
        </div>
      ))}
    </div>
  );
}

/** The X that removes one of the visitor's own presets. */
function RemoveButton({ preset, saved }: { preset: GraphPreset; saved: SavedGraphs }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Remove ${preset.name}`}
      title="Remove this preset"
      onClick={() => saved.remove(preset.id)}
      className="size-7"
    >
      <X aria-hidden />
    </Button>
  );
}
