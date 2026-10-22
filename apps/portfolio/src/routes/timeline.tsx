import { createFileRoute } from "@tanstack/react-router";
import { format, min } from "date-fns";
import { CalendarClock, ImageOff, RotateCcw } from "lucide-react";
import { useState } from "react";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoLocation } from "@/components/photo-location";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import { TimelineHistogram } from "@/components/timeline-histogram";
import { Button } from "@/components/ui/button";
import { TimeRangePicker } from "@/components/time-range-picker";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { buildHistogram } from "@/lib/histogram";
import {
  absoluteTimeRange,
  parseTimeRange,
  resolveTimeRange,
  type TimeRangeValue,
} from "@/lib/time-range";

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

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
  const [shown, setShown] = useState<ImagePhoto | null>(null);
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
      <PhotoMonths photos={inRange} onOpen={setShown} />
      <PhotoLightbox photo={shown} onClose={() => setShown(null)} />
    </div>
  );
}

function PhotoMonths({ photos, onOpen }: { photos: Photo[]; onOpen: (photo: ImagePhoto) => void }) {
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
          <ul className="flex flex-col gap-3 border-l pl-4">
            {monthPhotos.map((photo) => (
              <PhotoRow key={photo.id} photo={photo} onOpen={onOpen} />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/**
 * A photo's square thumbnail, title, comment, place, date and camera. The thumbnail and the title open
 * the photo in the lightbox; photos without resized versions in R2 have nothing to open.
 */
function PhotoRow({ photo, onOpen }: { photo: Photo; onOpen: (photo: ImagePhoto) => void }) {
  const { image } = photo;
  const open = image ? () => onOpen({ ...photo, image }) : undefined;
  return (
    <li className="flex items-center gap-3">
      <RowThumbnail image={image} title={photo.title} onOpen={open} />
      <div className="flex min-w-0 flex-1 flex-col">
        <RowTitle title={photo.title} onOpen={open} />
        {photo.comment && (
          <PhotoComment
            comment={photo.comment}
            lines={1}
            className="text-xs text-muted-foreground"
          />
        )}
        {photo.location && (
          <p className="truncate text-xs text-muted-foreground">
            {/* Beside it, so the details cover neither this title nor the next. */}
            <PhotoLocation location={photo.location} side="right" />
          </p>
        )}
      </div>
      <span className="shrink-0 self-baseline text-xs text-muted-foreground">
        {format(photo.takenAt, "MMM d")} · {photo.camera}
      </span>
    </li>
  );
}

/** The photo's square thumbnail, or an empty square for a photo without an image yet. */
function RowThumbnail({
  image,
  title,
  onOpen,
}: {
  image: PhotoImage | null;
  title: string;
  onOpen?: () => void;
}) {
  if (!image) {
    return (
      <div
        title="No image yet"
        className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        <ImageOff className="size-4" aria-hidden />
      </div>
    );
  }
  return (
    <button
      type="button"
      title="Show the whole photo"
      aria-label={`Show ${title}`}
      onClick={onOpen}
      className="relative size-12 shrink-0 cursor-zoom-in overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <PhotoThumbnail image={image} />
    </button>
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
