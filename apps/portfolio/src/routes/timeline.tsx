import { createFileRoute } from "@tanstack/react-router";
import { format, min } from "date-fns";
import { CalendarClock, ChevronDown, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoLocation } from "@/components/photo-location";
import { PhotoThumbnailButton } from "@/components/photo-thumbnail";
import { TechnicalInfo, TechnicalInfoToggle } from "@/components/technical-info";
import { TimelineHistogram } from "@/components/timeline-histogram";
import { Button } from "@/components/ui/button";
import { TimeRangePicker } from "@/components/time-range-picker";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { buildHistogram } from "@/lib/histogram";
import { cn } from "@/lib/utils";
import {
  absoluteTimeRange,
  parseTimeRange,
  resolveTimeRange,
  type TimeRangeValue,
} from "@/lib/time-range";

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

/** The time range, plus whether each photo shows its technical info; left out when it doesn't. */
type TimelineSearch = TimeRangeValue & { tech?: true };

export const Route = createFileRoute("/timeline")({
  validateSearch: (search: Record<string, unknown>): TimelineSearch => ({
    ...parseTimeRange(search),
    ...(search.tech === true ? { tech: true } : {}),
  }),
  component: TimelineView,
});

const earliestPhoto = min(photos.map((photo) => photo.takenAt));

/** Photos grouped by their date taken written with a date-fns pattern, such as "MMMM yyyy" for months. */
function groupByDate(group: Photo[], pattern: string) {
  const groups = new Map<string, Photo[]>();
  for (const photo of group) {
    const key = format(photo.takenAt, pattern);
    groups.set(key, [...(groups.get(key) ?? []), photo]);
  }
  return [...groups];
}

function TimelineView() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [now] = useState(() => new Date());
  const [shown, setShown] = useState<ImagePhoto | null>(null);
  const { start = earliestPhoto, end } = resolveTimeRange(search, now);
  // Newest first, so the months and the photos in each read down from the latest.
  const inRange = photos
    .filter(({ takenAt }) => takenAt >= start && takenAt <= end)
    .toSorted((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
  const { bins, resolution } = buildHistogram(
    inRange.map((photo) => photo.takenAt),
    start,
    end,
  );
  const { tech, ...range } = search;
  const isAllTime = Object.keys(range).length === 0;

  /** Moves to a new time range, keeping the technical info shown or hidden. */
  function selectRange(next: TimeRangeValue) {
    navigate({ search: { ...next, ...(tech && { tech }) } });
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
            value={range}
            selection={{ from: start, to: end }}
            onChange={selectRange}
          />
          <p className="text-sm text-muted-foreground">{inRange.length} photos in range</p>
          <TechnicalInfoToggle
            shown={tech === true}
            onChange={(show) => navigate({ search: { ...range, ...(show && { tech: true }) } })}
          />
          <Button variant="outline" size="sm" disabled={isAllTime} onClick={() => selectRange({})}>
            <RotateCcw aria-hidden />
            Reset
          </Button>
        </div>
      </header>
      <TimelineHistogram
        bins={bins}
        resolution={resolution}
        onSelect={(from, to) => selectRange(absoluteTimeRange(from, to))}
      />
      <PhotoMonths photos={inRange} showTech={tech === true} onOpen={setShown} />
      <PhotoLightbox photo={shown} onClose={() => setShown(null)} />
    </div>
  );
}

/** What each photo row needs from the page: whether to show technical info, and how to open it. */
interface RowOptions {
  showTech: boolean;
  onOpen: (photo: ImagePhoto) => void;
}

function PhotoMonths({ photos, ...options }: RowOptions & { photos: Photo[] }) {
  if (photos.length === 0) {
    return <p className="text-muted-foreground">No photos in this time range.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {groupByDate(photos, "MMMM yyyy").map(([month, monthPhotos]) => (
        <MonthSection key={month} month={month} monthPhotos={monthPhotos} {...options} />
      ))}
    </ol>
  );
}

/** A month's heading and its photos, which the heading's button hides and shows again. */
function MonthSection({
  month,
  monthPhotos,
  ...options
}: RowOptions & { month: string; monthPhotos: Photo[] }) {
  const [open, setOpen] = useState(true);
  const listId = useId();
  return (
    <li className="flex flex-col gap-1">
      {/* Sticks to the top while the month's photos scroll under it. */}
      <h2 className="sticky top-0 z-10 -mx-1 bg-background px-1 py-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-sm text-sm font-medium tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", !open && "-rotate-90")}
            aria-hidden
          />
          {month}
          <span className="ml-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tracking-normal text-foreground tabular-nums">
            {monthPhotos.length}
          </span>
        </button>
      </h2>
      {open && (
        <ol id={listId} className="flex flex-col gap-4">
          {groupByDate(monthPhotos, "EEEE, MMMM d").map(([day, dayPhotos]) => (
            <DaySection key={day} day={day} dayPhotos={dayPhotos} {...options} />
          ))}
        </ol>
      )}
    </li>
  );
}

/** A day's subheading and its photos, within its month. */
function DaySection({
  day,
  dayPhotos,
  ...options
}: RowOptions & { day: string; dayPhotos: Photo[] }) {
  return (
    <li className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{day}</h3>
      <ul className="flex flex-col gap-3">
        {dayPhotos.map((photo) => (
          <PhotoRow key={photo.id} photo={photo} {...options} />
        ))}
      </ul>
    </li>
  );
}

/**
 * A photo's square thumbnail, title, comment, technical info when shown, and place; its day is in
 * the subheading above. The thumbnail and the title open the photo in the lightbox; photos without
 * resized versions in R2 have nothing to open.
 */
function PhotoRow({ photo, showTech, onOpen }: RowOptions & { photo: Photo }) {
  const { image } = photo;
  const open = image ? () => onOpen({ ...photo, image }) : undefined;
  return (
    <li className="flex items-center gap-3">
      <PhotoThumbnailButton image={image} title={photo.title} onOpen={open} className="size-12" />
      <div className="flex min-w-0 flex-1 flex-col">
        <RowTitle title={photo.title} onOpen={open} />
        <RowDetails photo={photo} showTech={showTech} />
      </div>
    </li>
  );
}

/** What's under the photo's title: its comment, its technical info when shown, then its place. */
function RowDetails({ photo, showTech }: { photo: Photo; showTech: boolean }) {
  return (
    <>
      {photo.comment && (
        <PhotoComment comment={photo.comment} lines={1} className="text-xs text-muted-foreground" />
      )}
      {showTech && <TechnicalInfo photo={photo} />}
      {photo.location && (
        <p className="truncate text-xs text-muted-foreground">
          {/* Beside it, so the details cover neither this title nor the next. */}
          <PhotoLocation location={photo.location} side="right" />
        </p>
      )}
    </>
  );
}

/** The photo's title, a button opening the lightbox when there's an image to show. */
function RowTitle({ title, onOpen }: { title: string; onOpen?: () => void }) {
  if (!onOpen) return <span className="truncate">{title}</span>;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="max-w-full cursor-zoom-in self-start truncate text-left underline-offset-4 outline-none hover:underline focus-visible:underline"
    >
      {title}
    </button>
  );
}
