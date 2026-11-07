import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarClock, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoFilterBar } from "@/components/photo-filters";
import { visualsOwnFilters } from "@/components/visuals-picker";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoLocation } from "@/components/photo-location";
import { PhotoThumbnailButton } from "@/components/photo-thumbnail";
import { SiteHomeLink } from "@/components/site-home-link";
import { TechnicalInfo } from "@/components/technical-info";
import { TimelineDisplayOptions } from "@/components/timeline-display-options";
import { TimelineScrubber } from "@/components/timeline-scrubber";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { labelOn } from "@/lib/timeline-labels";
import { withOldTimelineLinks } from "@/lib/timeline-old-links";
import { filterPhotos, hasFilters, parseFilters, type PhotoFilters } from "@/lib/photo-filters";
import { dayOf } from "@/lib/when-filters";
import { parseTextSearch, searchPhotos } from "@/lib/text-search";
import { filterByVisuals, parseVisualFilters, type VisualSearch } from "@/lib/visual-filters";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";
import {
  parseTimelineDisplay,
  resolveTimelineDisplay,
  THUMB_LAYOUT,
  timelineDisplaySearch,
  type TimelineDisplay,
  type TimelineDisplaySearch,
} from "@/lib/timeline-display";
import { useRememberViewOptions } from "@/lib/view-options";
import { cn } from "@/lib/utils";
import { RouteSketches, TimelineRouteSketch } from "@/components/timeline-route-sketch";
import { MonthMaps, TripLinesButton, useMonthTripLines } from "@/components/timeline-month-map";

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

/**
 * The filters (their date range is the days the Timeline shows), the open photo and the display
 * options; each left out when it's the default.
 */
type TimelineSearch = PhotoFilters &
  VisualSearch &
  ShownPhotoSearch &
  TimelineDisplaySearch & { q?: string };

export const Route = createFileRoute("/timeline")({
  validateSearch: (raw: Record<string, unknown>): TimelineSearch => {
    // Links from before the time range, label and Quick dates pickers became filters still work.
    const search = withOldTimelineLinks(raw, new Date());
    return {
      ...parseFilters(search),
      ...parseVisualFilters(search),
      ...parseTextSearch(search),
      ...parseShownPhoto(search),
      ...parseTimelineDisplay(search),
    };
  },
  component: TimelineView,
});

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
  const { shown, show, close } = useShownPhoto();
  const filters = parseFilters(search);
  // What the filters and search leave before Visuals, which its counts are out of.
  const beforeVisuals = searchPhotos(filterPhotos(photos, filters), search.q);
  // Newest first, so the months and the photos in each read down from the latest.
  const inRange = filterByVisuals(beforeVisuals, search).toSorted(
    (a, b) => b.takenAt.getTime() - a.takenAt.getTime(),
  );
  const display = resolveTimelineDisplay(search);
  const [header, setHeader] = useState<HTMLElement | null>(null);
  const [list, setList] = useState<HTMLOListElement | null>(null);
  useRememberViewOptions("/timeline", timelineDisplaySearch(display));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6">
      <header ref={setHeader} className="flex flex-col gap-4">
        <div>
          <SiteHomeLink className="mb-1" />
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <CalendarClock className="size-8 text-muted-foreground" aria-hidden />
            Timeline
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">{inRange.length} photos in range</p>
        <PhotoFilterBar
          photos={photos}
          searchable
          own={visualsOwnFilters(beforeVisuals, search)}
          end={
            <TimelineDisplayOptions
              display={display}
              onChange={(change) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    ...timelineDisplaySearch({ ...display, ...change }),
                  }),
                })
              }
            />
          }
        />
      </header>
      <RouteSketches>
        <PhotoMonths
          photos={inRange}
          filtered={hasFilters(filters) || search.q !== undefined}
          display={display}
          onOpen={show}
          listRef={setList}
        />
      </RouteSketches>
      <TimelineScrubber list={list} above={header} byDay={display.ticks === "days"} />
      <PhotoLightbox photo={shown} photos={inRange} onShow={show} onClose={close} />
    </div>
  );
}

/** What each photo row needs from the page: the display options, and how to open a photo. */
interface RowOptions {
  display: TimelineDisplay;
  onOpen: (photo: ImagePhoto) => void;
}

function PhotoMonths({
  photos,
  filtered,
  listRef,
  ...options
}: RowOptions & {
  photos: Photo[];
  /** Given the list of months, for the scrubber to measure. */
  listRef: (list: HTMLOListElement | null) => void;
  /** Whether any filter is set, so an empty range can say the filters may be why. */
  filtered: boolean;
}) {
  if (photos.length === 0) {
    const matching = filtered ? "match these filters" : "were taken";
    return <p className="text-muted-foreground">No photos {matching} in this time range.</p>;
  }

  return (
    <ol ref={listRef} className="flex flex-col gap-4">
      {groupByDate(photos, "MMMM yyyy").map(([month, monthPhotos]) => (
        <MonthSection key={month} month={month} monthPhotos={monthPhotos} {...options} />
      ))}
    </ol>
  );
}

/**
 * A month's heading and its photos, which the heading's button hides and shows again, with its trip
 * line maps under it when its **Trip lines** button has them open.
 */
function MonthSection({
  month,
  monthPhotos,
  ...options
}: RowOptions & { month: string; monthPhotos: Photo[] }) {
  const [open, setOpen] = useState(true);
  const listId = useId();
  const lines = useMonthTripLines(monthPhotos, options.display.maps);
  return (
    <li
      data-month={month}
      data-group={month.slice(-4)}
      data-year={month.slice(-4)}
      className="relative flex flex-col gap-1"
    >
      {/* Sticks to the top while the month's photos scroll under it. Its fixed height (h-10) is
          where each day's subheading sticks, just under it. */}
      <h2 className="sticky top-0 z-10 -mx-1 flex h-10 items-center bg-background px-1">
        <MonthButton
          month={month}
          count={monthPhotos.length}
          open={open}
          controls={listId}
          onToggle={() => setOpen(!open)}
        />
      </h2>
      {/* At the right end of the heading's line, but not in the heading, so it scrolls away with
          the month instead of sticking with it. */}
      <div className="absolute top-1.5 right-0 z-[11]">
        {open && <TripLinesButton lines={lines} />}
      </div>
      {open && (
        <div id={listId} className="flex flex-col gap-4">
          <MonthMaps lines={lines} />
          <ol className="flex flex-col gap-4">
            {groupByDate(monthPhotos, "EEEE, MMMM d").map(([day, dayPhotos]) => (
              <DaySection key={day} day={day} dayPhotos={dayPhotos} {...options} />
            ))}
          </ol>
        </div>
      )}
    </li>
  );
}

/** The month's name and photo count, a button that hides and shows its photos. */
function MonthButton({
  month,
  count,
  open,
  controls,
  onToggle,
}: {
  month: string;
  count: number;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="flex items-center gap-1.5 rounded-sm text-sm font-medium tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronDown
        className={cn("size-4 transition-transform", !open && "-rotate-90")}
        aria-hidden
      />
      {month}
      <span className="ml-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tracking-normal text-foreground tabular-nums">
        {count}
      </span>
    </button>
  );
}

/** A day's subheading and its photos, within its month. */
function DaySection({
  day,
  dayPhotos,
  ...options
}: RowOptions & { day: string; dayPhotos: Photo[] }) {
  const label = dayLabel(dayPhotos);
  // The scrubber reads data-label to name the label of the days under its pointer.
  return (
    <li
      data-day={day}
      data-group={dayGroup(dayPhotos)}
      data-year={dayFormat(dayPhotos, "yyyy")}
      data-name={dayFormat(dayPhotos, "EEEE, MMMM d, yyyy")}
      data-label={label}
      className="flex flex-col gap-1"
    >
      {/* Sticks just under the month's heading while the day's photos scroll under it, so the
          label beside the date reads as the label of the month's days now in view. */}
      <h3 className="sticky top-10 z-[5] -mx-1 flex items-center gap-2 bg-background px-1 py-1 text-xs font-medium text-muted-foreground">
        <span className="shrink-0">{day}</span>
        <DayLabel label={label} />
        <TimelineRouteSketch day={dayFormat(dayPhotos, "yyyy-MM-dd")} />
      </h3>
      <ul className="flex flex-col gap-3">
        {dayPhotos.map((photo) => (
          <PhotoRow key={photo.id} photo={photo} {...options} />
        ))}
      </ul>
    </li>
  );
}

/** The short month of the day the photos were taken, such as "Sep", which the scrubber labels days by. */
function dayGroup(dayPhotos: Photo[]): string {
  return dayFormat(dayPhotos, "MMM");
}

/** The day the photos were taken written with a date-fns pattern, or "" without photos. */
function dayFormat(dayPhotos: Photo[], pattern: string): string {
  const [first] = dayPhotos;
  return first ? format(first.takenAt, pattern) : "";
}

/** The timeline label of the days the photos were taken, or "" without one. */
function dayLabel(dayPhotos: Photo[]): string {
  const [first] = dayPhotos;
  return first ? labelOn(dayOf(first.takenAt)) : "";
}

/** The day's timeline label beside its date; nothing without one. */
function DayLabel({ label }: { label: string }) {
  if (!label) return null;
  return (
    <span className="min-w-0 truncate rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground">
      {label}
    </span>
  );
}

/**
 * A photo's square thumbnail at the chosen size, title, and the details the display options show;
 * its day is in the subheading above. The thumbnail and the title open the photo in the lightbox;
 * photos without resized versions in R2 have nothing to open.
 */
function PhotoRow({ photo, display, onOpen }: RowOptions & { photo: Photo }) {
  const { image } = photo;
  const open = image ? () => onOpen({ ...photo, image }) : undefined;
  const layout = THUMB_LAYOUT[display.thumbs];
  return (
    <li className={cn("flex gap-3", layout.row)} data-photo-id={photo.id}>
      <PhotoThumbnailButton
        image={image}
        title={photo.title}
        onOpen={open}
        className={layout.thumbnail}
      />
      <div className="flex w-full min-w-0 flex-1 flex-col">
        <RowTitle title={photo.title} onOpen={open} />
        <RowDetails photo={photo} display={display} />
      </div>
    </li>
  );
}

/** What's under the photo's title, each when shown: its comment, technical info, then place. */
function RowDetails({ photo, display }: { photo: Photo; display: TimelineDisplay }) {
  return (
    <>
      {display.comments && <RowComment comment={photo.comment} />}
      {display.tech && <TechnicalInfo photo={photo} />}
      {display.places && <RowPlace location={photo.location} />}
    </>
  );
}

/** The photo's comment on one line, when it has one. */
function RowComment({ comment }: { comment: Photo["comment"] }) {
  if (!comment) return null;
  return <PhotoComment comment={comment} lines={1} className="text-xs text-muted-foreground" />;
}

/** Where the photo was taken, when it says. */
function RowPlace({ location }: { location: Photo["location"] }) {
  if (!location) return null;
  return (
    <p className="truncate text-xs text-muted-foreground">
      {/* Beside it, so the details cover neither this title nor the next. */}
      <PhotoLocation location={location} side="right" />
    </p>
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
