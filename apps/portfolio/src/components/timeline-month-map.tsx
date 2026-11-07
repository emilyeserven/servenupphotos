import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { SketchDrawing, useDaysSketch } from "@/components/timeline-route-sketch";
import { fitView } from "@/lib/fit-view";
import type { Photo } from "@/lib/photos";
import { MONTH_SKETCH_SIZE } from "@/lib/route-sketch";

/** The days the photos were taken, as TRIPLINES.geo.json writes them, earliest first. */
function daysOf(photos: Photo[]): string[] {
  return [...new Set(photos.map((p) => format(p.takenAt, "yyyy-MM-dd")))].toSorted();
}

/** The days' dates, such as "Oct 1" or "Oct 1, 3, 25". */
function daysText(days: string[]): string {
  const [first = ""] = days;
  const rest = days.slice(1).map((day) => format(parseISO(day), "d"));
  return [format(parseISO(first), "MMM d"), ...rest].join(", ");
}

/**
 * Under a month's heading on the Timeline, every trip line of its days drawn together as one small
 * map in the Map's line styles, labelled with the days that have one and linking to the Map on
 * them, zoomed to fit; nothing for a month without a trip line.
 */
export function TimelineMonthMap({ monthPhotos }: { monthPhotos: Photo[] }) {
  const drawn = useDaysSketch(daysOf(monthPhotos), MONTH_SKETCH_SIZE);
  if (!drawn) return null;
  const { days, sketch } = drawn;
  const dates = daysText(days);
  return (
    <Link
      to="/map"
      search={{
        start: days[0],
        end: days.at(-1),
        ...fitView(sketch.bounds, window.innerWidth, window.innerHeight),
      }}
      aria-label={`Show this month's trip lines (${dates}) on the map`}
      className="group flex w-fit flex-col gap-1 self-start rounded-md bg-muted/60 p-1.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SketchDrawing sketch={sketch} size={MONTH_SKETCH_SIZE} />
      <span className="px-0.5 text-xs text-muted-foreground tabular-nums group-hover:text-foreground">
        {dates}
      </span>
    </Link>
  );
}
