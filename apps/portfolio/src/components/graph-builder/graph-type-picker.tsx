import {
  ChartColumn,
  ChartLine,
  ChartNoAxesColumn,
  ChartPie,
  ChartScatter,
  ChevronsUpDown,
  Grip,
  Grid3x3,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { SectionPicker } from "@portfolio/components/section-picker";
import { statsBySection } from "@portfolio/components/graph-builder/graph-field";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
import { type GraphConfig, type GraphType, SPLIT_TYPES, statById } from "@portfolio/lib/graph-data";

/** A change to some of the graph's settings. */
type ConfigChange = (change: Partial<GraphConfig>) => void;

/** The graph types, with their names and icons. */
const TYPES: [GraphType, string, LucideIcon][] = [
  ["bar", "Bar", ChartColumn],
  ["line", "Line", ChartLine],
  ["dot", "Dot", ChartNoAxesColumn],
  ["pie", "Pie", ChartPie],
  ["scatter", "Scatter", ChartScatter],
  ["heatmap", "Heatmap", Grid3x3],
  ["photos", "Photo dots", Grip],
];

/** The graph type's name and icon. */
function typeOf(type: GraphType): [GraphType, string, LucideIcon] {
  return TYPES.find(([each]) => each === type) ?? TYPES[0]!;
}

/** The graph type's name, such as Bar, for the Presets picker's settings. */
export function graphTypeName(type: GraphType): string {
  return typeOf(type)[1];
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
  const sections: [TypeSection, string, string][] = [["type", "Type", typeOf(config.type)[1]]];
  if (!SPLIT_TYPES.has(config.type)) return sections;
  sections.push(["split", "Split by", splitText(config)]);
  if (config.type === "bar" && config.split !== "") {
    sections.push(["parts", "Parts", partsText(config)]);
  }
  return sections;
}

/** What the button says: the type, and what splits it when something does. */
function buttonText(config: GraphConfig): string {
  const name = typeOf(config.type)[1];
  const sections = sectionsOf(config);
  const split = sections.find(([key]) => key === "split");
  return split && config.split !== "" ? `${name}, split by ${split[2]}` : name;
}

/**
 * The **Graph type** button, like the Grid's **Gear & settings**: it opens a list of Type, Split by
 * (for the bar, line and dot graphs, which can be split) and Parts (for a split bar) on the left,
 * each saying what it's set to, and the chosen one's choices on the right (see `SectionPicker`).
 */
export function GraphTypePicker({
  config,
  onChange,
}: {
  config: GraphConfig;
  onChange: ConfigChange;
}) {
  const Icon = typeOf(config.type)[2];
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">Graph type</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Graph type: ${buttonText(config)}`}
            className="max-w-72 justify-start font-normal"
          >
            <Icon className="text-muted-foreground" aria-hidden />
            <span className="truncate">{buttonText(config)}</span>
            <ChevronsUpDown className="ml-auto opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={16}
          className="w-auto max-w-[calc(100vw-2rem)] p-0"
        >
          <PickerBody config={config} onChange={onChange} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** The sections and the chosen section's choices beside them, or under them on phones. */
function PickerBody({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  const [chosen, setChosen] = useState<TypeSection>("type");
  const sections = sectionsOf(config);
  const section = sections.some(([key]) => key === chosen) ? chosen : "type";
  return (
    <SectionPicker
      label="Graph type"
      sections={sections.map(([key, label, text]) => ({ key, label, text }))}
      chosen={section}
      onChoose={setChosen}
      width="sm:w-[30rem]"
    >
      <div className="-m-1 flex flex-col">
        <SectionChoices section={section} config={config} onChange={onChange} />
      </div>
    </SectionPicker>
  );
}

/** The chosen section's choices. */
function SectionChoices({
  section,
  config,
  onChange,
}: {
  section: TypeSection;
  config: GraphConfig;
  onChange: ConfigChange;
}) {
  if (section === "split") return <SplitChoices config={config} onChange={onChange} />;
  if (section === "parts") return <PartsChoices config={config} onChange={onChange} />;
  return <TypeChoices config={config} onChange={onChange} />;
}

/** The graph types to pick from. */
function TypeChoices({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  return TYPES.map(([type, label]) => (
    <ChoiceRow
      key={type}
      label={label}
      on={config.type === type}
      onClick={() => onChange({ type })}
    />
  ));
}

/** Nothing, or a stat other than the x axis's to split by, under the sections they're in. */
function SplitChoices({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  return (
    <>
      <ChoiceRow label="Nothing" on={config.split === ""} onClick={() => onChange({ split: "" })} />
      {statsBySection().map(([section, stats]) => (
        <div key={section} role="group" aria-label={section} className="flex flex-col">
          <span className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
            {section}
          </span>
          {stats
            .filter((stat) => stat.id !== config.x)
            .map((stat) => (
              <ChoiceRow
                key={stat.id}
                label={stat.label}
                on={config.split === stat.id}
                onClick={() => onChange({ split: stat.id })}
              />
            ))}
        </div>
      ))}
    </>
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
