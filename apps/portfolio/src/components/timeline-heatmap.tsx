import { endOfWeek, format, parseISO } from "date-fns";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import type { HeatmapLevel, HeatmapWeek, HeatmapYear } from "@/lib/heatmap";
import { cn } from "@/lib/utils";

/** Two days' keys, `yyyy-MM-dd`, from the earlier to the later. */
export interface DayRange {
  from: string;
  to: string;
}

interface Drag {
  anchor: string;
  current: string;
}

/** Each level's square color: muted for no photos, then the chart's blue, darker the more photos. */
const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: "bg-muted",
  1: "bg-chart-2/40",
  2: "bg-chart-2/60",
  3: "bg-chart-2/80",
  4: "bg-chart-2",
};

function plural(count: number) {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

/** The weeks dragged across, by their Sundays' keys, from the earlier to the later. */
function sortedRange({ anchor, current }: Drag): DayRange {
  return anchor <= current ? { from: anchor, to: current } : { from: current, to: anchor };
}

/** Whether any of a week's days are in a range of days. */
function overlaps(week: HeatmapWeek, range: DayRange | undefined): boolean {
  return range !== undefined && week.endKey >= range.from && week.key <= range.to;
}

/** The week square under a point on the screen, by its Sunday's key. */
function weekAt(event: PointerEvent): string | undefined {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  return element?.closest<HTMLElement>("[data-week]")?.dataset.week;
}

/** How many photos were taken in the weeks between two Sundays, both included. */
function countBetween(years: HeatmapYear[], range: DayRange): number {
  return years
    .flatMap((year) => year.months.flatMap((month) => month.weeks))
    .filter((week) => week.key >= range.from && week.key <= range.to)
    .reduce((sum, week) => sum + week.count, 0);
}

/** A run of years: one with photos to draw, or several in a row without any, to sum up. */
type YearGroup =
  | { kind: "year"; year: HeatmapYear }
  | { kind: "empty"; first: number; last: number };

/** The groups so far with one more year: drawn if it has photos, else added to a run without any. */
function addYear(groups: YearGroup[], year: HeatmapYear): YearGroup[] {
  if (year.total > 0) return [...groups, { kind: "year", year }];
  const last = groups.at(-1);
  if (last?.kind !== "empty")
    return [...groups, { kind: "empty", first: year.year, last: year.year }];
  last.last = year.year;
  return groups;
}

/** The years, with each run of years without photos folded into one narrow note. */
function groupYears(years: HeatmapYear[]): YearGroup[] {
  return years.reduce(addYear, []);
}

/**
 * A heatmap of photos per week, a block per year side by side, oldest on the left; it scrolls
 * sideways through the years and starts at the newest. Each month is a column of the weeks that
 * start in it. Click a week to select it, or click and drag across weeks to select a span. Weeks
 * outside the selected time range are faded.
 */
export function TimelineHeatmap({
  years,
  shown,
  onSelect,
}: {
  years: HeatmapYear[];
  /** The selected time range's days; left out for "All time", so no week is faded. */
  shown?: DayRange;
  onSelect: (from: Date, to: Date) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragged = drag ? sortedRange(drag) : undefined;
  const scroller = useRef<HTMLDivElement>(null);

  // Start at the newest year, on the right.
  useEffect(() => {
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth });
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const key = weekAt(event);
    if (!key) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ anchor: key, current: key });
  }

  function handlePointerMove(event: PointerEvent) {
    const key = weekAt(event);
    if (key) setDrag((current) => current && { ...current, current: key });
  }

  function handlePointerUp() {
    setDrag(null);
    if (dragged) onSelect(parseISO(dragged.from), endOfWeek(parseISO(dragged.to)));
  }

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 text-xs text-muted-foreground">
        <figcaption>Photos per week</figcaption>
        <DragHint years={years} dragged={dragged} />
      </div>
      <div ref={scroller} className="overflow-x-auto pb-2">
        <div
          className="flex w-max cursor-crosshair items-start gap-6 select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          {groupYears(years).map((group) =>
            group.kind === "year" ? (
              <YearBlock key={group.year.year} year={group.year} shown={shown} dragged={dragged} />
            ) : (
              <EmptyYears key={group.first} first={group.first} last={group.last} />
            ),
          )}
        </div>
      </div>
      <Legend />
    </figure>
  );
}

/** What dragging does, or while dragging, the weeks being dragged across and their photo count. */
function DragHint({ years, dragged }: { years: HeatmapYear[]; dragged?: DayRange }) {
  if (!dragged) return <span>Click a week or drag across weeks to select a range</span>;
  const from = format(parseISO(dragged.from), "MMM d, yyyy");
  const to = format(endOfWeek(parseISO(dragged.to)), "MMM d, yyyy");
  return (
    <span className="font-medium text-foreground">
      {from} – {to} · {plural(countBetween(years, dragged))}
    </span>
  );
}

/** A narrow note for a run of years without photos, so they take little room. */
function EmptyYears({ first, last }: { first: number; last: number }) {
  const years = first === last ? `${first}` : `${first}–${last}`;
  return (
    <p className="flex w-16 flex-col self-stretch text-xs text-muted-foreground">
      <span className="font-medium">{years}</span>
      <span>No photos</span>
    </p>
  );
}

/** One year's squares: a column per month, the weeks that start in it from top to bottom. */
function YearBlock({
  year,
  shown,
  dragged,
}: {
  year: HeatmapYear;
  shown?: DayRange;
  dragged?: DayRange;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{year.year}</span>
        <span className="text-muted-foreground">{plural(year.total)}</span>
      </div>
      <div className="flex gap-[3px]">
        {year.months.map((month) => (
          <div key={month.label} className="flex w-3.5 flex-col items-center gap-[3px]">
            <span className="text-[10px] leading-4 text-muted-foreground" title={month.label}>
              {month.label[0]}
            </span>
            {month.weeks.map((week) => (
              <WeekSquare key={week.key} week={week} shown={shown} dragged={dragged} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** One week's square, colored by its photo count. */
function WeekSquare({
  week,
  shown,
  dragged,
}: {
  week: HeatmapWeek;
  shown?: DayRange;
  dragged?: DayRange;
}) {
  const days = `${format(week.start, "MMM d")} – ${format(week.end, "MMM d, yyyy")}`;
  return (
    <span
      data-week={week.key}
      title={`${plural(week.count)}, ${days}`}
      className={squareClass(week, shown, dragged)}
    />
  );
}

/** A week's square color, faded outside the selected range and outlined while dragged across. */
function squareClass(week: HeatmapWeek, shown?: DayRange, dragged?: DayRange): string {
  return cn(
    "size-3.5 rounded-[3px]",
    LEVEL_CLASS[week.level],
    shown && !overlaps(week, shown) && "opacity-30",
    overlaps(week, dragged) && "ring-1 ring-foreground ring-inset",
  );
}

/** The squares' colors from no photos to the busiest weeks. */
function Legend() {
  return (
    <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
      Less
      {Object.values(LEVEL_CLASS).map((color) => (
        <span key={color} className={cn("size-2.5 rounded-[2px]", color)} />
      ))}
      More
    </div>
  );
}
