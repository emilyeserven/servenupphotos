import { graphTypeName } from "@portfolio/components/graph-builder/graph-type-picker";
import { type GraphConfig, hasYStat, SPLIT_TYPES, statById } from "@portfolio/lib/graph-data";
import { orderName } from "@portfolio/lib/graph-order";
import { evenText } from "@portfolio/lib/even-buckets";

/** One line of a preset's settings: its name and what it's set to, such as X axis: Aperture. */
type SettingLine = [string, string];

/** What the y axis shows: a second stat, or what's measured. */
function yText(config: GraphConfig): string {
  if (hasYStat(config.type)) return statById(config.y).label;
  return config.measure === "percent" ? "Share of photos (%)" : "Photos";
}

/** What splits the graph, and how a split bar's parts sit; none when nothing does. */
function splitLines(config: GraphConfig): SettingLine[] {
  if (!SPLIT_TYPES.has(config.type) || config.split === "") return [];
  return [["Split by", `${statById(config.split).label}${partsText(config)}`]];
}

/** How a split bar's parts sit, after its split; nothing for a line graph. */
function partsText(config: GraphConfig): string {
  if (config.type !== "bar") return "";
  return config.stacked ? ", stacked" : ", side by side";
}

/** Two ends as text, such as "f/2 – f/8", with Start and End for the axis's own. */
function endsText(from: string | number | null, to: string | number | null): string {
  return `${from ?? "Start"} – ${to ?? "End"}`;
}

/** Whether either end is set. */
function either(from: unknown, to: unknown): boolean {
  return from !== null || to !== null;
}

/** Each part of the Range group as a line, or null while it's off. */
const RANGE_PARTS: ((r: GraphConfig) => SettingLine | null)[] = [
  (r) => (either(r.xFrom, r.xTo) ? ["X range", endsText(r.xFrom, r.xTo)] : null),
  (r) => (either(r.yFrom, r.yTo) ? ["Y range", endsText(r.yFrom, r.yTo)] : null),
  (r) => (either(r.yMin, r.yMax) ? ["Y range", endsText(r.yMin ?? 0, r.yMax)] : null),
  (r) => (r.minPhotos > 0 ? ["Photos per value", `At least ${r.minPhotos}`] : null),
  (r) => (r.hideZeros ? ["Empty ends", "Trimmed"] : null),
  (r) => (r.xBucket > 1 ? ["X buckets", `Every ${r.xBucket} values`] : null),
  (r) => (r.yBucket > 1 ? ["Y buckets", `Every ${r.yBucket} values`] : null),
  (r) => (r.xWidth > 0 ? ["X buckets", evenText(r.x, r.xWidth)] : null),
  (r) => (r.yWidth > 0 ? ["Y buckets", evenText(r.y, r.yWidth)] : null),
];

/** The Range group's parts that are on. */
function rangeLines(r: GraphConfig): SettingLine[] {
  return RANGE_PARTS.map((part) => part(r)).filter((line) => line !== null);
}

/** Every setting a preset sets the graph to, line by line. */
function settingLines(config: GraphConfig): SettingLine[] {
  return [
    ["Type", graphTypeName(config.type)],
    [config.type === "pie" ? "Slices" : "X axis", statById(config.x).label],
    [config.type === "pie" ? "Size" : "Y axis", yText(config)],
    ...splitLines(config),
    ["Order", orderName(config.x, "X axis", config.sort)],
    ["Show", config.limit === 0 ? "All" : `First ${config.limit}`],
    ...rangeLines(config),
  ];
}

/** The settings panel of the Presets picker: what the preset pointed at, or picked, sets the graph to. */
export function PresetSettings({ name, config }: { name?: string; config?: GraphConfig }) {
  if (!name || !config) {
    return (
      <p className="p-2 text-xs text-muted-foreground">Point at a preset to see its settings.</p>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-2 text-sm">
      <span className="font-medium">{name}</span>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        {settingLines(config).map(([label, value], index) => (
          <div key={index} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="truncate">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
