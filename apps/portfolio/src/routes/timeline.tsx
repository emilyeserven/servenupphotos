import { createFileRoute } from "@tanstack/react-router";
import { format, startOfDay, subDays } from "date-fns";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { TimeRangePicker } from "@/components/time-range-picker";
import { parseTimeRange, resolveTimeRange, type TimeRangeValue } from "@/lib/time-range";

export const Route = createFileRoute("/timeline")({
  validateSearch: (search: Record<string, unknown>): TimeRangeValue => parseTimeRange(search),
  component: TimelineView,
});

interface DummyPhoto {
  id: number;
  title: string;
  camera: string;
  takenAt: Date;
}

// Temporary dummy data until real photos are wired up. Dates are relative to today so every
// quick range has something in it.
const dummyTitles = [
  "Morning fog over the bay",
  "Neon alley",
  "Harbor at dusk",
  "Cherry blossoms",
  "Old train station",
  "Market stalls",
  "Mountain ridge",
  "Rainy crosswalk",
  "Lighthouse",
  "Desert road",
  "Autumn canopy",
  "Rooftop sunset",
];
const dummyCameras = ["Fujifilm X-T5", "Sony A7 IV", "Ricoh GR III", "iPhone 16 Pro"];
const today = startOfDay(new Date());
const dummyPhotos: DummyPhoto[] = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  title: dummyTitles[i % dummyTitles.length] ?? "Untitled",
  camera: dummyCameras[i % dummyCameras.length] ?? "Unknown camera",
  takenAt: subDays(today, i * 12 + ((i * 7) % 11)),
}));

function groupByMonth(photos: DummyPhoto[]) {
  const months = new Map<string, DummyPhoto[]>();
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
  const { start = new Date(0), end } = resolveTimeRange(search, now);
  const photos = dummyPhotos.filter(({ takenAt }) => takenAt >= start && takenAt <= end);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-4">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <CalendarClock className="size-8 text-muted-foreground" aria-hidden />
          Timeline
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <TimeRangePicker value={search} onChange={(next) => navigate({ search: next })} />
          <p className="text-sm text-muted-foreground">{photos.length} photos in range</p>
        </div>
      </header>
      <PhotoMonths photos={photos} />
    </div>
  );
}

function PhotoMonths({ photos }: { photos: DummyPhoto[] }) {
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
                <span>{photo.title}</span>
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
