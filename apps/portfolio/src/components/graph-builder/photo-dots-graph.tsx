import { GraphLegend } from "@/components/graph-builder/graph-parts";
import { pickedOpacity, useGraphPick } from "@/components/graph-builder/graph-pick-context";
import { ColumnNames } from "@/components/graph-builder/heatmap-graph";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DotColumn, PhotoDot, PhotoDotsData } from "@/lib/graph-photo-dots";

/** A count of photos as words, such as "1 photo" or "12 photos". */
function photoCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "photo" : "photos"}`;
}

/** How many rows of dots the tallest stack gets, at most, so the graph keeps a height that fits a screen. */
const MOST_ROWS = 30;

/** How wide a dot and the gap after it are, in pixels. */
const DOT_STEP = 13;

/** How wide each stack is, in pixels: enough dots across that the tallest stack fits in MOST_ROWS rows. */
function stackWidth(data: PhotoDotsData): number {
  const most = Math.max(1, ...data.columns.map((column) => column.dots.length));
  return Math.max(2, Math.ceil(most / MOST_ROWS)) * DOT_STEP - 3;
}

/**
 * A photo dot graph: a stack of dots over each x value, one for every photo it has, so the tallest
 * stack has the most photos. A split colors each dot by the photo's split value, with the split's
 * key over the graph. Hovering a dot names its photo; clicking a stack picks its x value, so its
 * photos show under the graph. It scrolls sideways when the x values don't fit.
 */
export function PhotoDotsGraph({ data, xName }: { data: PhotoDotsData; xName: string }) {
  const width = stackWidth(data);
  const columns = {
    gridTemplateColumns: `repeat(${data.columns.length}, minmax(${width + 8}px, 1fr))`,
  };
  return (
    <div className="flex flex-col gap-3">
      {data.series.length > 0 && <GraphLegend items={data.series} />}
      <div className="overflow-x-auto">
        <div
          role="group"
          aria-label={`Photos by ${xName}`}
          className="grid min-w-fit gap-x-1"
          style={columns}
        >
          {data.columns.map((column) => (
            <DotStack key={column.label} column={column} width={width} />
          ))}
          <ColumnNames labels={data.columns.map((column) => column.label)} corner={false} />
        </div>
      </div>
    </div>
  );
}

/** One x value's dots, stacked up from the axis with its photo count on top, as a button that picks it. */
function DotStack({ column, width }: { column: DotColumn; width: number }) {
  const { pick, onPick } = useGraphPick();
  return (
    <button
      type="button"
      aria-label={`${column.label}: ${photoCount(column.dots.length)}`}
      aria-pressed={pick?.x === column.label}
      onClick={() => onPick({ x: column.label })}
      style={{ opacity: pickedOpacity(pick, column.label) }}
      className="flex min-h-40 cursor-pointer flex-col justify-end gap-1 rounded-sm border-b px-0.5 pb-1 outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="text-center text-[11px] text-muted-foreground tabular-nums">
        {column.dots.length.toLocaleString()}
      </span>
      <span
        className="mx-auto flex flex-wrap-reverse justify-center gap-[3px]"
        style={{ maxWidth: width }}
      >
        {column.dots.map((dot) => (
          <Dot key={dot.photo.id} dot={dot} />
        ))}
      </span>
    </button>
  );
}

/** One photo's dot, in its color, naming the photo and when it was taken on hover. */
function Dot({ dot }: { dot: PhotoDot }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="size-2.5 rounded-full" style={{ background: dot.color }} />
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">{dot.photo.title}</div>
        <div>{dot.photo.takenAt.toLocaleDateString()}</div>
      </TooltipContent>
    </Tooltip>
  );
}
