import { useState } from "react";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { GraphTypeInfo } from "@portfolio/components/graph-builder/graph-type-info";
import { PickerPart } from "@portfolio/components/section-picker";
import { StatChoices } from "@portfolio/components/graph-builder/stat-choices";
import { GraphPicker } from "@portfolio/components/graph-builder/graph-picker";
import { GRAPH_TYPES, graphTypeOf } from "@portfolio/components/graph-builder/graph-types";
import { type GraphConfig, type GraphType, SPLIT_TYPES, statById } from "@portfolio/lib/graph-data";

/** A change to some of the graph's settings. */
type ConfigChange = (change: Partial<GraphConfig>) => void;

/** The graph type's name, such as Bar, for the Presets picker's settings. */
export function graphTypeName(type: GraphType): string {
  return graphTypeOf(type)[1];
}

/** One section of the Graph type picker. */
type TypeSection = "type" | "split" | "parts";

/** What a split bar's parts can be, with their names. */
const PARTS: [boolean, string][] = [
  [true, "Stacked"],
  [false, "Side by side"],
];

/** What the split section says it's set to: the stat that splits the graph, or Nothing. */
function splitText(config: GraphConfig): string {
  return config.split === "" ? "Nothing" : statById(config.split).label;
}

/** What the parts section says it's set to. */
function partsText(config: GraphConfig): string {
  return config.stacked ? "Stacked" : "Side by side";
}

/** Each section the graph has, with its name and what it's set to: Split by only when the type can be split, Parts only for a split bar. */
function sectionsOf(config: GraphConfig): [TypeSection, string, string][] {
  const sections: [TypeSection, string, string][] = [["type", "Type", graphTypeOf(config.type)[1]]];
  if (!SPLIT_TYPES.has(config.type)) return sections;
  sections.push(["split", "Split by", splitText(config)]);
  if (config.type === "bar" && config.split !== "") {
    sections.push(["parts", "Parts", partsText(config)]);
  }
  return sections;
}

/** What the Type section's (i) shows: whether it's on, and the type pointed at. */
interface TypeInfo {
  open: boolean;
  onToggle: () => void;
  onPoint: (type: GraphType | undefined) => void;
}

/**
 * The **Graph type** button, like the Grid's **Gear & settings**: it opens a list of Type, Split by
 * (for the bar, line and photo dot graphs, which can be split) and Parts (for a split bar) on the left,
 * each saying what it's set to, and the chosen one's choices on the right. Its icon is the type's.
 * The Type section's (i) shows the info pane: a diagram of the type pointed at, or else the one
 * chosen, and the data it suits best (`GraphTypeInfo`).
 */
export function GraphTypePicker({
  config,
  onChange,
}: {
  config: GraphConfig;
  onChange: ConfigChange;
}) {
  const [open, setOpen] = useState(false);
  const [pointed, setPointed] = useState<GraphType | undefined>();
  const info: TypeInfo = { open, onToggle: () => setOpen(!open), onPoint: setPointed };
  const shown = graphTypeOf(pointed ?? config.type);
  return (
    <GraphPicker
      label="Graph type"
      Icon={graphTypeOf(config.type)[2]}
      sections={sectionsOf(config)}
      aside={(section) =>
        section === "type" && open ? <GraphTypeInfo type={shown[0]} name={shown[1]} /> : undefined
      }
    >
      {(section) => (
        <SectionChoices section={section} config={config} onChange={onChange} info={info} />
      )}
    </GraphPicker>
  );
}

/** The chosen section's choices. */
function SectionChoices({
  section,
  config,
  onChange,
  info,
}: {
  section: TypeSection;
  config: GraphConfig;
  onChange: ConfigChange;
  info: TypeInfo;
}) {
  if (section === "split") return <SplitChoices config={config} onChange={onChange} />;
  if (section === "parts") return <PartsChoices config={config} onChange={onChange} />;
  return <TypeChoices config={config} onChange={onChange} info={info} />;
}

/** The graph types to pick from, each with its icon, under a line with the (i) for the info pane. */
function TypeChoices({
  config,
  onChange,
  info,
}: {
  config: GraphConfig;
  onChange: ConfigChange;
  info: TypeInfo;
}) {
  return (
    <div className="p-1">
      <PickerPart intro="How the graph draws its values." info={info}>
        <div className="-mx-1 flex flex-col" onMouseLeave={() => info.onPoint(undefined)}>
          {GRAPH_TYPES.map(([type, label, Icon]) => (
            <ChoiceRow
              key={type}
              label={label}
              icon={<Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
              on={config.type === type}
              onClick={() => onChange({ type })}
              onMouseEnter={() => info.onPoint(type)}
              onFocus={() => info.onPoint(type)}
            />
          ))}
        </div>
      </PickerPart>
    </div>
  );
}

/** Nothing, or a stat other than the x axis's to split by, under the sections they're in. */
function SplitChoices({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  return (
    <StatChoices
      value={config.split}
      leaveOut={[config.x]}
      none="Nothing"
      onPick={(split) => onChange({ split })}
    />
  );
}

/** Whether a split bar's parts stack or stand side by side. */
function PartsChoices({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  return PARTS.map(([stacked, label]) => (
    <ChoiceRow
      key={label}
      label={label}
      on={config.stacked === stacked}
      onClick={() => onChange({ stacked })}
    />
  ));
}
