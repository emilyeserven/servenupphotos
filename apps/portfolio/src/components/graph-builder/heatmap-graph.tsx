import type { CSSProperties } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScatterData } from "@/lib/graph-data";
import { cn } from "@/lib/utils";

/** How many x values fit before their names are written sideways. */
const UPRIGHT_LABELS = 8;

/** The faintest a cell with photos gets, in percent of the series color, so a cell of one still shows. */
const FAINTEST = 15;

/** Each cell's photo count, by its x and y places. */
function countsByCell(data: ScatterData): Map<string, number> {
  return new Map(data.points.map((point) => [`${point.x}:${point.y}`, point.count]));
}

/** The most photos any cell has, and never less than 1. */
function mostPhotos(data: ScatterData): number {
  return Math.max(1, ...data.points.map((point) => point.count));
}

/** How much of the series color a cell with this share of the most photos gets, in percent. */
function strength(share: number): number {
  return Math.round(FAINTEST + (100 - FAINTEST) * share);
}

/** The series color mixed into the card's, as much as the percent. */
function shade(percent: number): string {
  return `color-mix(in oklab, var(--series-1) ${percent}%, var(--card))`;
}

/** A cell's look: the card's muted gray when it has no photos, or else as dark as its share of the most. */
function cellStyle(count: number, most: number): CSSProperties | undefined {
  return count > 0 ? { background: shade(strength(count / most)) } : undefined;
}

/** A cell's text color: white on the darker cells, so the count stays readable. */
function textClass(count: number, most: number): string {
  return count / most > 0.5 ? "text-white" : "text-foreground";
}

/**
 * A heatmap of two stats: a grid of the x values across and the y values down, each cell as dark as
 * how many photos have both, such as month by year or aperture by focal length. The first y value
 * is at the top. It scrolls sideways when the x values don't fit.
 */
export function HeatmapGraph({
  data,
  xName,
  yName,
}: {
  data: ScatterData;
  xName: string;
  yName: string;
}) {
  const counts = countsByCell(data);
  const most = mostPhotos(data);
  const columns = {
    gridTemplateColumns: `max-content repeat(${data.xLabels.length}, minmax(2.5rem, 1fr))`,
  };
  return (
    <div className="flex flex-col gap-3">
      <HeatmapKey most={most} />
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
                  count={counts.get(`${x}:${y}`) ?? 0}
                  most={most}
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

/** The x values' names under the grid, written sideways when there are many. */
function ColumnNames({ labels }: { labels: string[] }) {
  const sideways = labels.length > UPRIGHT_LABELS;
  return (
    <div role="row" className="contents">
      <span aria-hidden className="sticky left-0 z-10 bg-card" />
      {labels.map((label) => (
        <div
          key={label}
          role="columnheader"
          title={label}
          className={cn(
            "flex min-w-0 justify-center pt-1 text-xs text-muted-foreground",
            sideways && "max-h-28 [writing-mode:vertical-rl] rotate-180 justify-end",
          )}
        >
          <span className="truncate">{label}</span>
        </div>
      ))}
    </div>
  );
}

/** One cell: its count on a shade as dark as its share of the most photos, and its values on hover. */
function HeatCell({
  xLabel,
  yLabel,
  count,
  most,
}: {
  xLabel: string;
  yLabel: string;
  count: number;
  most: number;
}) {
  const photos = `${count.toLocaleString()} ${count === 1 ? "photo" : "photos"}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="cell"
          aria-label={`${xLabel} · ${yLabel}: ${photos}`}
          className={cn(
            "flex h-9 items-center justify-center rounded-sm bg-muted/50 text-[11px] tabular-nums",
            textClass(count, most),
          )}
          style={cellStyle(count, most)}
        >
          {count > 0 && count.toLocaleString()}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">
          {xLabel} · {yLabel}
        </div>
        <div className="tabular-nums">{photos}</div>
      </TooltipContent>
    </Tooltip>
  );
}

/** The heatmap's key: a strip from the faintest shade to the darkest, with how many photos each end means. */
function HeatmapKey({ most }: { most: number }) {
  const strip = { background: `linear-gradient(to right, ${shade(FAINTEST)}, ${shade(100)})` };
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
      <span>1</span>
      <span className="h-2.5 w-32 rounded-[3px]" style={strip} aria-hidden />
      <span>{most.toLocaleString()} photos</span>
    </div>
  );
}
