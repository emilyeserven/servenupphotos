import { Move3d } from "lucide-react";
import { ChoiceRow } from "@portfolio/components/choice-row";
import {
  GraphPicker,
  type GraphPickerSection,
} from "@portfolio/components/graph-builder/graph-picker";
import { StatChoices } from "@portfolio/components/graph-builder/stat-choices";
import { type GraphConfig, hasYStat, type Measure, statById } from "@portfolio/lib/graph-data";
import { orderChoices, orderName } from "@portfolio/lib/graph-order";

/** A change to some of the graph's settings. */
type ConfigChange = (change: Partial<GraphConfig>) => void;

/** One section of the Axes picker. */
type AxesSection = "x" | "y" | "order";

/** What a bar, line, dot or pie graph can measure, with their names. */
export const MEASURES: [Measure, string][] = [
  ["count", "Photos"],
  ["percent", "Share of photos (%)"],
];

/** The x axis's name: a pie's slices, or the x axis. */
export function xName(config: GraphConfig): string {
  return config.type === "pie" ? "Slices" : "X axis";
}

/** What the y axis shows: a second stat, or what's measured. */
function yText(config: GraphConfig): string {
  if (hasYStat(config.type)) return statById(config.y).label;
  return MEASURES.find(([measure]) => measure === config.measure)?.[1] ?? "";
}

/** The picker's sections, each with what it's set to. */
function sectionsOf(config: GraphConfig): GraphPickerSection<AxesSection>[] {
  return [
    ["x", xName(config), statById(config.x).label],
    ["y", config.type === "pie" ? "Size" : "Y axis", yText(config)],
    ["order", "Order", orderName(config.x, xName(config), config.sort)],
  ];
}

/**
 * The **Axes** button, like **Graph type**: what's along the x axis (or a pie's slices), what's
 * along the y axis (a second stat for a scatterplot or heatmap, else what's measured), and the x
 * axis's order, such as "X axis, asc".
 */
export function AxesPicker({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  return (
    <GraphPicker label="Axes" Icon={Move3d} sections={sectionsOf(config)}>
      {(section) => <AxesChoices section={section} config={config} onChange={onChange} />}
    </GraphPicker>
  );
}

/** The chosen section's choices. */
function AxesChoices({
  section,
  config,
  onChange,
}: {
  section: AxesSection;
  config: GraphConfig;
  onChange: ConfigChange;
}) {
  if (section === "x") return <StatChoices value={config.x} onPick={(x) => onChange({ x })} />;
  if (section === "order") return <OrderChoices config={config} onChange={onChange} />;
  return <YChoices config={config} onChange={onChange} />;
}

/** A second stat for a scatterplot or heatmap, or what a bar, line, dot or pie graph measures. */
function YChoices({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  if (hasYStat(config.type)) {
    return <StatChoices value={config.y} leaveOut={[config.x]} onPick={(y) => onChange({ y })} />;
  }
  return MEASURES.map(([measure, label]) => (
    <ChoiceRow
      key={measure}
      label={label}
      on={config.measure === measure}
      onClick={() => onChange({ measure })}
    />
  ));
}

/** The x axis's orders. */
function OrderChoices({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  return orderChoices(config.x, xName(config)).map(([sort, label]) => (
    <ChoiceRow
      key={sort}
      label={label}
      on={config.sort === sort}
      onClick={() => onChange({ sort })}
    />
  ));
}
