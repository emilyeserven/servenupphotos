import { format, parseISO } from "date-fns";
import { type PointerEvent, useState } from "react";
import type { HeatmapDay, HeatmapLevel, HeatmapYear } from "@/lib/heatmap";
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

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function plural(count: number) {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

function sortedRange({ anchor, current }: Drag): DayRange {
  return anchor <= current ? { from: anchor, to: current } : { from: current, to: anchor };
}

function isBetween(key: string, range: DayRange | undefined): boolean {
  return range !== undefined && key >= range.from && key <= range.to;
}

/** The day square under a point on the screen, by its key. */
function dayAt(event: PointerEvent): string | undefined {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  return element?.closest<HTMLElement>("[data-day]")?.dataset.day;
}

/** How many photos were taken between two days, both included. */
function countBetween(years: HeatmapYear[], range: DayRange): number {
  return years
    .flatMap((year) => year.weeks.flat())
    .filter((day): day is HeatmapDay => day !== null && isBetween(day.key, range))
    .reduce((sum, day) => sum + day.count, 0);
}

/** A run of years: one with photos to draw, or several in a row without any, to sum up in a line. */
type YearGroup =
  | { kind: "year"; year: HeatmapYear }
  | { kind: "empty"; newest: number; oldest: number };

/** The groups so far with one more year: drawn if it has photos, else added to a run without any. */
function addYear(groups: YearGroup[], year: HeatmapYear): YearGroup[] {
  if (year.total > 0) return [...groups, { kind: "year", year }];
  const last = groups.at(-1);
  if (last?.kind !== "empty")
    return [...groups, { kind: "empty", newest: year.year, oldest: year.year }];
  last.oldest = year.year;
  return groups;
}

/** The years, with each run of years without photos folded into one line. */
function groupYears(years: HeatmapYear[]): YearGroup[] {
  return years.reduce(addYear, []);
}

/**
 * A GitHub-style heatmap of photos per day, one block per year, newest first. Click a day to
 * select it, or click and drag across days to select a span. Days outside the selected time range
 * are faded.
 */
export function TimelineHeatmap({
  years,
  shown,
  onSelect,
}: {
  years: HeatmapYear[];
  /** The selected time range's days; left out for "All time", so no day is faded. */
  shown?: DayRange;
  onSelect: (from: Date, to: Date) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragged = drag ? sortedRange(drag) : undefined;

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const key = dayAt(event);
    if (!key) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ anchor: key, current: key });
  }

  function handlePointerMove(event: PointerEvent) {
    const key = dayAt(event);
    if (key) setDrag((current) => current && { ...current, current: key });
  }

  function handlePointerUp() {
    setDrag(null);
    if (dragged) onSelect(parseISO(dragged.from), parseISO(dragged.to));
  }

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 text-xs text-muted-foreground">
        <figcaption>Photos per day</figcaption>
        <DragHint years={years} dragged={dragged} />
      </div>
      <div
        className="flex cursor-crosshair touch-pan-y flex-col gap-5 select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        {groupYears(years).map((group) =>
          group.kind === "year" ? (
            <YearBlock key={group.year.year} year={group.year} shown={shown} dragged={dragged} />
          ) : (
            <EmptyYears key={group.newest} newest={group.newest} oldest={group.oldest} />
          ),
        )}
      </div>
      <Legend />
    </figure>
  );
}

/** What dragging does, or while dragging, the span being dragged across and its photo count. */
function DragHint({ years, dragged }: { years: HeatmapYear[]; dragged?: DayRange }) {
  if (!dragged) return <span>Click a day or drag across days to select a range</span>;
  const days = [dragged.from, dragged.to].map((key) => format(parseISO(key), "MMM d, yyyy"));
  return (
    <span className="font-medium text-foreground">
      {[...new Set(days)].join(" – ")} · {plural(countBetween(years, dragged))}
    </span>
  );
}

/** One line for a run of years without photos, so they take no room. */
function EmptyYears({ newest, oldest }: { newest: number; oldest: number }) {
  const years = newest === oldest ? `${newest}` : `${oldest}–${newest}`;
  return <p className="text-xs text-muted-foreground">{years}: no photos</p>;
}

/** One year's squares: weeks as columns, Sunday to Saturday as rows, with the months above. */
function YearBlock({
  year,
  shown,
  dragged,
}: {
  year: HeatmapYear;
  shown?: DayRange;
  dragged?: DayRange;
}) {
  const columns = { gridTemplateColumns: `repeat(${year.weeks.length}, minmax(0, 1fr))` };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{year.year}</span>
        <span className="text-muted-foreground">{plural(year.total)}</span>
      </div>
      <div className="flex gap-1.5">
        <WeekdayLabels />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="grid text-[10px] text-muted-foreground" style={columns}>
            {year.months.map((month) => (
              <span key={month.label} style={{ gridColumnStart: month.week + 1 }}>
                {month.label}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-px sm:gap-[2px]" style={columns}>
            {year.weeks.flat().map((day, index) => (
              <DaySquare
                key={day?.key ?? `blank-${index}`}
                day={day}
                shown={shown}
                dragged={dragged}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mon, Wed and Fri beside their rows, as on GitHub; hidden on phones, where room is short. */
function WeekdayLabels() {
  return (
    <div className="mt-[15px] hidden grid-rows-7 gap-[2px] text-[10px] leading-none text-muted-foreground sm:grid">
      {WEEKDAY_LABELS.map((label, index) => (
        <span key={index} className="flex items-center">
          {label}
        </span>
      ))}
    </div>
  );
}

/** One day's square, colored by its photo count; blank for days outside the year or to come. */
function DaySquare({
  day,
  shown,
  dragged,
}: {
  day: HeatmapDay | null;
  shown?: DayRange;
  dragged?: DayRange;
}) {
  if (!day) return <span className="aspect-square" />;
  return (
    <span
      data-day={day.key}
      title={`${plural(day.count)} on ${format(day.date, "EEE, MMM d, yyyy")}`}
      className={squareClass(day, shown, dragged)}
    />
  );
}

/** A day's square color, faded outside the selected range and outlined while dragged across. */
function squareClass(day: HeatmapDay, shown?: DayRange, dragged?: DayRange): string {
  return cn(
    "aspect-square rounded-[2px]",
    LEVEL_CLASS[day.level],
    shown && !isBetween(day.key, shown) && "opacity-30",
    isBetween(day.key, dragged) && "ring-1 ring-foreground ring-inset",
  );
}

/** The squares' colors from no photos to the busiest days. */
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
