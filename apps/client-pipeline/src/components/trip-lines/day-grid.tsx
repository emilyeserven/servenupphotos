import { Link } from "@tanstack/react-router";
import type { TripLine } from "@/api/trip-lines";
import { dayTitle } from "@/components/trip-lines/day-title";
import { LinePreview } from "@/components/trip-lines/line-preview";
import type { TripDay } from "@/lib/trip-days";
import { type DayFilter, useTripLinesSearch } from "@/lib/trip-lines-search";
import { cn } from "@/lib/utils";

/**
 * Whether a day's line is marked by hand, marked by hand but out of date with the day's photos,
 * automatic, or not there yet.
 */
type LineStatus = "Marked" | "Out of date" | "Automatic" | "None";

const FILTERS: ("All" | LineStatus)[] = ["All", "Marked", "Out of date", "Automatic", "None"];

/** How each status reads in the list: out of date in red, so it stands out. */
const STATUS_CLASS: Record<LineStatus, string> = {
  Marked: "text-foreground",
  "Out of date": "text-destructive font-medium",
  Automatic: "text-foreground",
  None: "text-muted-foreground",
};

/** A filter's label as the URL writes it, such as "out-of-date"; none for All. */
function filterParam(label: (typeof FILTERS)[number]): DayFilter | undefined {
  return label === "All" ? undefined : (label.toLowerCase().replaceAll(" ", "-") as DayFilter);
}

/** The filter the URL names, All unless it names one. */
function filterOf(show: DayFilter | undefined): (typeof FILTERS)[number] {
  return FILTERS.find((f) => filterParam(f) === show) ?? "All";
}

function statusOf(line: TripLine | undefined, stale: Set<string>): LineStatus {
  if (!line) return "None";
  if (line.auto) return "Automatic";
  return stale.has(line.day) ? "Out of date" : "Marked";
}

/** The days' lines: each day's, and which are out of date with their photos. */
interface DayGridProps {
  days: TripDay[];
  lines: Map<string, TripLine>;
  /** The days whose hand-marked line is out of date with their photos. */
  stale: Set<string>;
}

/**
 * The days a trip line can be marked for, newest first, each a card with its status and a drawing of
 * its line when it's marked by hand, linking to the day's pages; with a filter by status.
 */
export function DayGrid({ days, lines, stale }: DayGridProps) {
  const { search, set } = useTripLinesSearch();
  const filter = filterOf(search.show);
  const shown = days.filter(
    (d) => filter === "All" || statusOf(lines.get(d.day), stale) === filter,
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => set({ show: filterParam(f) })}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs",
              filter === f && "bg-muted font-medium",
            )}
          >
            {f}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="text-muted-foreground text-sm">None.</p>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((d) => (
          <li key={d.day}>
            <DayCard day={d} line={lines.get(d.day)} status={statusOf(lines.get(d.day), stale)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface DayCardProps {
  day: TripDay;
  line?: TripLine;
  status: LineStatus;
}

/** One day: its date, photos and spots, its line's status, and a drawing of its line. */
function DayCard({ day, line, status }: DayCardProps) {
  return (
    <Link
      to="/trip-lines/$day/$part"
      params={{ day: day.day, part: "order" }}
      className="hover:bg-muted/50 flex h-full flex-col gap-2 rounded-lg border p-3 text-sm"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate font-medium">{dayTitle(day.day)}</span>
        <span className={cn("shrink-0 text-xs", STATUS_CLASS[status])}>{status}</span>
      </span>
      <span className="text-muted-foreground text-xs">
        {day.photos.length} photos, {day.spots} spots
      </span>
      <Preview day={day} line={line} />
    </Link>
  );
}

/** The line drawn small when it's marked by hand, or a note on why there's no drawing. */
function Preview({ day, line }: { day: TripDay; line?: TripLine }) {
  if (isDrawn(line)) return <LinePreview photos={day.photos} line={line as TripLine} />;
  return (
    <span className="bg-muted/50 text-muted-foreground flex aspect-[2/1] items-center justify-center rounded-md px-3 text-center text-xs">
      {line?.auto ? "Automatic line, worked out when opened" : "No line yet"}
    </span>
  );
}

/** Whether the line is marked by hand, with segments to draw. */
function isDrawn(line: TripLine | undefined): boolean {
  return (line?.segments.length ?? 0) > 0;
}
