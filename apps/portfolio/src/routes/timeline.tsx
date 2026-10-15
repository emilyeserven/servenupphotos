import { createFileRoute } from "@tanstack/react-router";
import { addHours, format, min, startOfDay, subDays } from "date-fns";
import { CalendarClock, RotateCcw } from "lucide-react";
import { useState } from "react";
import { TimelineHistogram } from "@/components/timeline-histogram";
import { Button } from "@/components/ui/button";
import { DateRangeFields, QuickRangeSelect } from "@/components/time-range-picker";
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

interface DummyPhoto {
  id: number;
  title: string;
  camera: string;
  takenAt: Date;
}

// Temporary dummy data until real photos are wired up: about two years of shoot days, each with a
// handful of photos. Dates are relative to today so every quick range has something in it, and a
// seeded generator keeps the data stable between reloads.
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

function seededRandom(seed: number) {
  let state = seed;
  return (max: number) => {
    // Park–Miller generator; good enough for stable dummy data.
    state = (state * 48_271) % 2_147_483_647;
    return Math.floor((state / 2_147_483_647) * max);
  };
}

function makeDummyPhotos(): DummyPhoto[] {
  const random = seededRandom(42);
  const pick = (items: string[]) => items[random(items.length)] ?? "";
  const today = startOfDay(new Date());
  const photos: DummyPhoto[] = [];
  for (let daysAgo = random(3); daysAgo < 730; daysAgo += 1 + random(8)) {
    const shootDay = addHours(subDays(today, daysAgo), 8);
    const shots = Array.from({ length: 1 + random(6) }, (_, shot) => ({
      id: photos.length + shot + 1,
      title: pick(dummyTitles),
      camera: pick(dummyCameras),
      takenAt: addHours(shootDay, shot),
    }));
    photos.push(...shots);
  }
  return photos;
}

const dummyPhotos = makeDummyPhotos();
const earliestPhoto = min(dummyPhotos.map((photo) => photo.takenAt));

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
  const { start = earliestPhoto, end } = resolveTimeRange(search, now);
  const photos = dummyPhotos.filter(({ takenAt }) => takenAt >= start && takenAt <= end);
  const { bins, resolution } = buildHistogram(
    photos.map((photo) => photo.takenAt),
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
          <QuickRangeSelect value={search} onChange={(next) => navigate({ search: next })} />
          <p className="text-sm text-muted-foreground">{photos.length} photos in range</p>
          <Button
            variant="outline"
            size="sm"
            disabled={isAllTime}
            onClick={() => navigate({ search: {} })}
          >
            <RotateCcw aria-hidden />
            Reset
          </Button>
        </div>
      </header>
      <div className="flex flex-col gap-3">
        <TimelineHistogram bins={bins} resolution={resolution} onSelect={selectDates} />
        <DateRangeFields start={start} end={end} onChange={selectDates} />
      </div>
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
