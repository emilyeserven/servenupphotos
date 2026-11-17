import type { CSSProperties } from "react";
import { useGraphPick } from "@/components/graph-builder/graph-pick-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatValue, type Measure, type ScatterData, type ScatterPoint } from "@/lib/graph-data";
import type { GraphPick } from "@/lib/graph-pick";
import { cn } from "@/lib/utils";

/** How many x values fit before their names are written sideways. */
const UPRIGHT_LABELS = 8;

/** The faintest a cell with photos gets, in percent of the series color, so a cell of one still shows. */
const FAINTEST = 15;

/** Each cell with photos, by its x and y places. */
function cellsByPlace(data: ScatterData): Map<string, ScatterPoint> {
  return new Map(data.points.map((point) => [`${point.x}:${point.y}`, point]));
}

/** The highest value any cell has (its photos, or its share), and never less than the least shown. */
function mostOf(data: ScatterData, measure: Measure): number {
  const least = measure === "count" ? 1 : 0.1;
  return Math.max(least, ...data.points.map((point) => point.value));
}

/** How much of the series color a cell with this share of the most photos gets, in percent. */
function strength(share: number): number {
  return Math.round(FAINTEST + (100 - FAINTEST) * share);
}

/** The series color mixed into the card's, as much as the percent. */
function shade(percent: number): string {
  return `color-mix(in oklab, var(--series-1) ${percent}%, var(--card))`;
}

/** A cell's look: the card's muted gray when it has no photos, or else as dark as its value is of the most. */
function cellStyle(value: number, most: number): CSSProperties | undefined {
  return value > 0 ? { background: shade(strength(value / most)) } : undefined;
}

/** A cell's text color: white on the darker cells, so the number stays readable. */
function textClass(value: number, most: number): string {
  return value / most > 0.5 ? "text-white" : "text-foreground";
}

/** A cell with no photos. */
const EMPTY: Pick<ScatterPoint, "count" | "value"> = { count: 0, value: 0 };

/**
 * A heatmap of two stats: a grid of the x values across and the y values down, each cell as dark as
 * how many photos have both, such as month by year or aperture by focal length. The first y value
 * is at the top. It scrolls sideways when the x values don't fit. Clicking a cell with photos picks
 * it, so its photos show under the graph, and fades the rest.
 */
export function HeatmapGraph({
  data,
  xName,
  yName,
  measure,
}: {
  data: ScatterData;
  xName: string;
  yName: string;
  /** What the cells show: photos, or each cell's share of its x value's or y value's photos. */
  measure: Measure;
}) {
  const cells = cellsByPlace(data);
  const most = mostOf(data, measure);
  const columns = {
    gridTemplateColumns: `max-content repeat(${data.xLabels.length}, minmax(2.5rem, 1fr))`,
  };
  return (
    <div className="flex flex-col gap-3">
      <HeatmapKey most={most} measure={measure} />
      <div className="overflow-x-auto">
        <div
          role="table"
          aria-label={`${yName} by ${xName}`}
          className="grid min-w-fit gap-0.5"
          style={columns}
        >
          {data.yLabels.map((yLabel, y) => (
            <div key={yLabel} role="row" className="contents">
              <RowName label={yLabel} />
              {data.xLabels.map((xLabel, x) => (
                <HeatCell
                  key={xLabel}
                  xLabel={xLabel}
                  yLabel={yLabel}
                  cell={cells.get(`${x}:${y}`) ?? EMPTY}
                  most={most}
                  measure={measure}
                />
              ))}
            </div>
          ))}
          <ColumnNames labels={data.xLabels} />
        </div>
      </div>
    </div>
  );
}

/** A y value's name at the start of its row. */
function RowName({ label }: { label: string }) {
  return (
    <div
      role="rowheader"
      title={label}
      className="sticky left-0 z-10 flex min-w-0 items-center justify-end bg-card pr-2 text-xs text-muted-foreground"
    >
      <span className="max-w-28 truncate">{label}</span>
    </div>
  );
}

/**
 * The x values' names under a grid of columns, written sideways when there are many: the heatmap's,
 * with an empty corner under its row names, and the photo dot graph's.
 */
export function ColumnNames({ labels, corner = true }: { labels: string[]; corner?: boolean }) {
  const sideways = labels.length > UPRIGHT_LABELS;
  return (
    <div role="row" className="contents">
      {corner && <span aria-hidden className="sticky left-0 z-10 bg-card" />}
      {labels.map((label) => (
        <div
          key={label}
          role="columnheader"
          title={label}
          className={cn(
            "flex min-w-0 justify-center pt-1 text-xs text-muted-foreground",
            sideways && "max-h-28 rotate-180 items-center justify-end [writing-mode:vertical-rl]",
          )}
        >
          <span className="truncate">{label}</span>
        </div>
      ))}
    </div>
  );
}

/** Whether the cell is the picked one, or faded because another is. */
function pickState(pick: GraphPick | null, xLabel: string, yLabel: string): boolean | null {
  if (pick === null) return null;
  return pick.x === xLabel && pick.y === yLabel;
}

/** How a cell looks while a cell is picked: ringed when it's the one, faded when it isn't. */
const PICKED_CLASS = { true: "ring-2 ring-foreground", false: "opacity-35" };

/**
 * A cell's photos and, when the cells show shares, its share of its x value's or y value's photos,
 * such as "12 photos, 8.5% of 2024's".
 */
function cellText(cell: Pick<ScatterPoint, "count" | "value">, measure: Measure, outOf: string) {
  const photos = `${cell.count.toLocaleString()} ${cell.count === 1 ? "photo" : "photos"}`;
  if (measure === "count") return photos;
  return `${photos}, ${formatValue(cell.value, measure)} of ${outOf}'s`;
}

/**
 * One cell: its value on a shade as dark as its share of the most, and its photos on hover. A cell
 * with photos is a button that picks it.
 */
function HeatCell({
  xLabel,
  yLabel,
  cell,
  most,
  measure,
}: {
  xLabel: string;
  yLabel: string;
  cell: Pick<ScatterPoint, "count" | "value">;
  most: number;
  measure: Measure;
}) {
  const { pick, onPick } = useGraphPick();
  const picked = pickState(pick, xLabel, yLabel);
  const { count, value } = cell;
  const photos = cellText(cell, measure, measure === "series" ? yLabel : xLabel);
  const look = cn(
    "flex h-9 w-full items-center justify-center rounded-sm bg-muted/50 text-[11px] tabular-nums",
    textClass(value, most),
    picked !== null && PICKED_CLASS[`${picked}`],
  );
  if (count === 0) {
    return <div role="cell" aria-label={`${xLabel} · ${yLabel}: ${photos}`} className={look} />;
  }
  return (
    <div role="cell">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${xLabel} · ${yLabel}: ${photos}`}
            aria-pressed={picked === true}
            onClick={() => onPick({ x: xLabel, y: yLabel })}
            className={cn(
              look,
              "cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            )}
            style={cellStyle(value, most)}
          >
            {formatValue(value, measure)}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="font-medium">
            {xLabel} · {yLabel}
          </div>
          <div className="tabular-nums">{photos}</div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/** The heatmap's key: a strip from the faintest shade to the darkest, with what each end means. */
function HeatmapKey({ most, measure }: { most: number; measure: Measure }) {
  const strip = { background: `linear-gradient(to right, ${shade(FAINTEST)}, ${shade(100)})` };
  const count = measure === "count";
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
      <span>{count ? "1" : "0%"}</span>
      <span className="h-2.5 w-32 rounded-[3px]" style={strip} aria-hidden />
      <span>{count ? `${most.toLocaleString()} photos` : formatValue(most, measure)}</span>
    </div>
  );
}
