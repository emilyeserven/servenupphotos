import { createFileRoute } from "@tanstack/react-router";
import { format, min } from "date-fns";
import { CalendarClock, RotateCcw } from "lucide-react";
import { useState } from "react";
import { PhotoNotes } from "@/components/photo-comment";
import { TimelineHistogram } from "@/components/timeline-histogram";
import { Button } from "@/components/ui/button";
import { TimeRangePicker } from "@/components/time-range-picker";
import { photos, type Photo } from "@/lib/photos";
import { buildHistogram } from "@/lib/histogram";
import {
  absoluteTimeRange,
  parseTimeRange,
  resolveTimeRange,
  type TimeRangeValue,
} from "@/lib/time-range";

export const Route = createFileRoute("/timeline")({
  validateSearch: (search: Record<string, unknown>): TimeRangeValue => parseTimeRange(search),
  component: TimelineView,
});

const earliestPhoto = min(photos.map((photo) => photo.takenAt));

function groupByMonth(photos: Photo[]) {
  const months = new Map<string, Photo[]>();
  for (const photo of photos) {
    const month = format(photo.takenAt, "MMMM yyyy");
    months.set(month, [...(months.get(month) ?? []), photo]);
  }
  return [...months];
}

function TimelineView() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [now] = useState(() => new Date());
  const { start = earliestPhoto, end } = resolveTimeRange(search, now);
  const inRange = photos.filter(({ takenAt }) => takenAt >= start && takenAt <= end);
  const { bins, resolution } = buildHistogram(
    inRange.map((photo) => photo.takenAt),
    start,
    end,
  );
  const isAllTime = Object.keys(search).length === 0;

  function selectDates(from: Date, to: Date) {
    navigate({ search: absoluteTimeRange(from, to) });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-4">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <CalendarClock className="size-8 text-muted-foreground" aria-hidden />
          Timeline
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <TimeRangePicker
            value={search}
            selection={{ from: start, to: end }}
            onChange={(next) => navigate({ search: next })}
          />
          <p className="text-sm text-muted-foreground">{inRange.length} photos in range</p>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={isAllTime}
            onClick={() => navigate({ search: {} })}
          >
            <RotateCcw aria-hidden />
            Reset
          </Button>
        </div>
      </header>
      <TimelineHistogram bins={bins} resolution={resolution} onSelect={selectDates} />
      <PhotoMonths photos={inRange} />
    </div>
  );
}

function PhotoMonths({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) {
    return <p className="text-muted-foreground">No photos in this time range.</p>;
  }

  return (
    <ol className="flex flex-col gap-8">
      {groupByMonth(photos).map(([month, monthPhotos]) => (
        <li key={month} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {month}
          </h2>
          <ul className="flex flex-col gap-2 border-l pl-4">
            {monthPhotos.map((photo) => (
              <li key={photo.id} className="flex items-baseline justify-between gap-4">
                <div className="flex min-w-0 flex-col">
                  <span>{photo.title}</span>
                  <PhotoNotes photo={photo} lines={1} className="text-xs text-muted-foreground" />
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(photo.takenAt, "MMM d")} · {photo.camera}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
