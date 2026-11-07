import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ChevronDown, Route } from "lucide-react";
import { useId, useState } from "react";
import {
  type DaysSketch,
  SketchDrawing,
  useDaysSketches,
} from "@/components/timeline-route-sketch";
import { fitView } from "@/lib/fit-view";
import type { Photo } from "@/lib/photos";
import { MONTH_SKETCH_SIZE } from "@/lib/route-sketch";
import { cn } from "@/lib/utils";

/** The days the photos were taken, as TRIPLINES.geo.json writes them, earliest first. */
function daysOf(photos: Photo[]): string[] {
  return [...new Set(photos.map((p) => format(p.takenAt, "yyyy-MM-dd")))].toSorted();
}

/** The days' dates, such as "Oct 1" or "Oct 1–3". */
function daysText(days: string[]): string {
  const [first = "", last = first] = [days[0], days.at(-1)];
  const from = format(parseISO(first), "MMM d");
  return first === last ? from : `${from}–${format(parseISO(last), "d")}`;
}

/**
 * Under a month's heading on the Timeline, a button that opens and closes small maps of every trip
 * line of its days, one for each place the lines are in, in the Map's line styles; nothing for a
 * month without a trip line. The maps start open or closed as the display options say.
 */
export function TimelineMonthMap({ monthPhotos, open }: { monthPhotos: Photo[]; open: boolean }) {
  const places = useDaysSketches(daysOf(monthPhotos), MONTH_SKETCH_SIZE);
  if (places.length === 0) return null;
  // Keyed by the option, so changing it in the display options opens or closes every month.
  return <PlaceMaps key={String(open)} places={places} startOpen={open} />;
}

/** The month's button and, while it's open, its maps. */
function PlaceMaps({ places, startOpen }: { places: DaysSketch[]; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const listId = useId();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="flex w-fit items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown
          className={cn("size-3.5 transition-transform", !open && "-rotate-90")}
          aria-hidden
        />
        <Route className="size-3.5" aria-hidden />
        Trip lines
      </button>
      {open && (
        <ul id={listId} aria-label="This month's trip lines" className="flex flex-wrap gap-2">
          {places.map((place) => (
            <li key={place.days.join(" ")}>
              <PlaceMap place={place} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One place's small map, with its days, linking to the Map on those days zoomed to fit them. */
function PlaceMap({ place: { days, sketch } }: { place: DaysSketch }) {
  const dates = daysText(days);
  return (
    <Link
      to="/map"
      search={{
        start: days[0],
        end: days.at(-1),
        ...fitView(sketch.bounds, window.innerWidth, window.innerHeight),
      }}
      aria-label={`Show the trip lines of ${dates} on the map`}
      className="group flex flex-col gap-1 rounded-md bg-muted/60 p-1.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SketchDrawing sketch={sketch} size={MONTH_SKETCH_SIZE} />
      <span className="px-0.5 text-xs text-muted-foreground tabular-nums group-hover:text-foreground">
        {dates}
      </span>
    </Link>
  );
}
