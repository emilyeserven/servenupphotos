import { createFileRoute } from "@tanstack/react-router";
import { format, min } from "date-fns";
import { CalendarClock, ChevronDown, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoFilterBar } from "@/components/photo-filters";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoLocation } from "@/components/photo-location";
import { PhotoThumbnailButton } from "@/components/photo-thumbnail";
import { QuickDatesPicker } from "@/components/quick-dates-picker";
import { SiteHomeLink } from "@/components/site-home-link";
import { TechnicalInfo } from "@/components/technical-info";
import { TimelineDisplayOptions } from "@/components/timeline-display-options";
import { TimelineScrubber } from "@/components/timeline-scrubber";
import { TimelineChart } from "@/components/timeline-chart";
import { Button } from "@/components/ui/button";
import { TimeRangePicker } from "@/components/time-range-picker";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { dayKey } from "@/lib/heatmap";
import { shownUnit, TIME_DIVISIONS, type TimeDivision } from "@/lib/busy-times";
import { findTimelineLabel, labelDates, labelOn } from "@/lib/timeline-labels";
import { TimelineLabelPicker } from "@/components/timeline-label-picker";
import { filterPhotos, hasFilters, parseFilters, type PhotoFilters } from "@/lib/photo-filters";
import { parseTextSearch, searchPhotos } from "@/lib/text-search";
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
import {
  absoluteTimeRange,
  parseTimeRange,
  resolveTimeRange,
  type TimeRangeValue,
} from "@/lib/time-range";

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

/**
 * The time range, filters and open photo, plus the display options and whether the chart is the
 * heatmap; each left out when it's the default.
 */
type TimelineSearch = TimeRangeValue &
  PhotoFilters &
  ShownPhotoSearch &
  TimelineDisplaySearch & { chart?: "heatmap"; label?: string; q?: string };

export const Route = createFileRoute("/timeline")({
  validateSearch: (search: Record<string, unknown>): TimelineSearch => ({
    ...parseTimeRange(search),
    ...parseFilters(search),
    ...parseTextSearch(search),
    ...parseShownPhoto(search),
    ...parseTimelineDisplay(search),
    ...(search.chart === "heatmap" ? { chart: "heatmap" as const } : {}),
    ...parseLabel(search.label),
  }),
  component: TimelineView,
});

const earliestPhoto = min(photos.map((photo) => photo.takenAt));

/** The timeline label ID in the URL (`?label=japan-2026-09-22`), when there's one. */
function parseLabel(label: unknown): { label?: string } {
  return typeof label === "string" && label ? { label } : {};
}

/** Whether the Timeline shows every photo's days: no time range and no label. */
function showsAllTime(range: TimeRangeValue, label: ReturnType<typeof findTimelineLabel>) {
  return Object.keys(range).length === 0 && !label;
}

/** What the time range picker shows: the label's days as dates while one is chosen. */
function pickerRange(
  range: TimeRangeValue,
  label: ReturnType<typeof findTimelineLabel>,
  days: { start: Date; end: Date },
): TimeRangeValue {
  return label ? absoluteTimeRange(days.start, days.end) : range;
}

/**
 * The days the Timeline shows: the chosen timeline label's, or else the time range's, with its
 * start at the oldest photo when it has none.
 */
function shownDays(label: ReturnType<typeof findTimelineLabel>, range: TimeRangeValue, now: Date) {
  if (label) return labelDates(label);
  const { start = earliestPhoto, end } = resolveTimeRange(range, now);
  return { start, end };
}

/** Photos grouped by the heading of their date taken, such as "September 2026" for months. */
function groupByDate(group: Photo[], { heading }: TimeDivision) {
  const groups = new Map<string, Photo[]>();
  for (const photo of group) {
    const key = heading(photo.takenAt);
    groups.set(key, [...(groups.get(key) ?? []), photo]);
  }
  return [...groups];
}

/**
 * The headings and subheadings the list divides its photos into: by month and day, unless the
 * time range is exactly one month, week or day (and no label is chosen).
 */
function timeDivisions(range: TimeRangeValue, label: ReturnType<typeof findTimelineLabel>) {
  const unit = label ? undefined : shownUnit(range);
  return TIME_DIVISIONS[unit ?? "all"];
}

function TimelineView() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [now] = useState(() => new Date());
  const { shown, show, close } = useShownPhoto();
  const filters = parseFilters(search);
  const timeRange = parseTimeRange(search);
  const label = findTimelineLabel(search.label);
  const { start, end } = shownDays(label, timeRange, now);
  // Newest first, so the months and the photos in each read down from the latest.
  const matching = searchPhotos(filterPhotos(photos, filters), search.q);
  const inRange = matching
    .filter(({ takenAt }) => takenAt >= start && takenAt <= end)
    .toSorted((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
  const isAllTime = showsAllTime(timeRange, label);
  const display = resolveTimelineDisplay(search);
  const [chart, setChart] = useState<HTMLDivElement | null>(null);
  const [list, setList] = useState<HTMLOListElement | null>(null);
  useRememberViewOptions("/timeline", { ...timelineDisplaySearch(display), chart: search.chart });

  /**
   * Shows the time range, or the timeline label's days, keeping the filters and the rest of the
   * view's options; a range and a label each replace the other.
   */
  function showRange(next: TimeRangeValue & { label?: string }) {
    navigate({
      search: (prev) => ({
        ...prev,
        range: undefined,
        from: undefined,
        to: undefined,
        label: undefined,
        ...next,
      }),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-4">
        <div>
          <SiteHomeLink className="mb-1" />
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <CalendarClock className="size-8 text-muted-foreground" aria-hidden />
            Timeline
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TimeRangePicker
            value={pickerRange(timeRange, label, { start, end })}
            selection={{ from: start, to: end }}
            onChange={showRange}
          />
          <QuickDatesPicker photos={matching} value={timeRange} onChange={showRange} />
          <TimelineLabelPicker value={label} onChange={(id) => showRange({ label: id })} />
          <p className="text-sm text-muted-foreground">{inRange.length} photos in range</p>
          <Button variant="outline" size="sm" disabled={isAllTime} onClick={() => showRange({})}>
            <RotateCcw aria-hidden />
            Reset
          </Button>
          <div className="ml-auto">
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
          </div>
        </div>
        <PhotoFilterBar photos={photos} searchable />
      </header>
      <div ref={setChart}>
        <TimelineChart
          mode={search.chart ?? "graph"}
          inRange={inRange.map((photo) => photo.takenAt)}
          all={matching.map((photo) => photo.takenAt)}
          start={start}
          end={end}
          now={now}
          shown={isAllTime ? undefined : { from: dayKey(start), to: dayKey(end) }}
          onSelect={(from, to) => showRange(absoluteTimeRange(from, to))}
        />
      </div>
      <PhotoMonths
        photos={inRange}
        filtered={hasFilters(filters) || search.q !== undefined}
        display={display}
        divisions={timeDivisions(timeRange, label)}
        onOpen={show}
        listRef={setList}
      />
      {/* With one label's days, the ticks are its days rather than a month or two. */}
      <TimelineScrubber list={list} chart={chart} byDay={label !== undefined} />
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
  divisions: [outer, inner],
  ...options
}: RowOptions & {
  photos: Photo[];
  /** The headings and subheadings the photos are divided into, such as months and days. */
  divisions: [TimeDivision, TimeDivision];
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
      {groupByDate(photos, outer).map(([month, monthPhotos]) => (
        <MonthSection
          key={month}
          month={month}
          monthPhotos={monthPhotos}
          outer={outer}
          inner={inner}
          {...options}
        />
      ))}
    </ol>
  );
}

/**
 * A month's heading (or a week's or day's, while the Timeline shows only one month or week) and its
 * photos, which the heading's button hides and shows again.
 */
function MonthSection({
  month,
  monthPhotos,
  outer,
  inner,
  ...options
}: RowOptions & {
  month: string;
  monthPhotos: Photo[];
  outer: TimeDivision;
  inner: TimeDivision;
}) {
  const [open, setOpen] = useState(true);
  const listId = useId();
  return (
    <li
      data-month={month}
      data-group={monthGroup(monthPhotos, outer)}
      className="flex flex-col gap-1"
    >
      {/* Sticks to the top while the month's photos scroll under it. Its fixed height (h-10) is
          where each day's subheading sticks, just under it. */}
      <h2 className="sticky top-0 z-10 -mx-1 flex h-10 items-center bg-background px-1">
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
          {groupByDate(monthPhotos, inner).map(([day, dayPhotos]) => (
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
  const label = dayLabel(dayPhotos);
  // The scrubber reads data-label to name the label of the days under its pointer.
  return (
    <li
      data-day={day}
      data-group={dayGroup(dayPhotos)}
      data-label={label}
      className="flex flex-col gap-1"
    >
      {/* Sticks just under the month's heading while the day's photos scroll under it, so the
          label beside the date reads as the label of the month's days now in view. */}
      <h3 className="sticky top-10 z-[5] -mx-1 flex items-center gap-2 bg-background px-1 py-1 text-xs font-medium text-muted-foreground">
        <span className="shrink-0">{day}</span>
        <DayLabel label={label} />
      </h3>
      <ul className="flex flex-col gap-3">
        {dayPhotos.map((photo) => (
          <PhotoRow key={photo.id} photo={photo} {...options} />
        ))}
      </ul>
    </li>
  );
}

/** The scrubber's group of the heading's photos, such as the year of a month. */
function monthGroup(monthPhotos: Photo[], { group }: TimeDivision): string {
  const [first] = monthPhotos;
  return first ? group(first.takenAt) : "";
}

/** The short month of the day the photos were taken, such as "Sep", which the scrubber labels days by. */
function dayGroup(dayPhotos: Photo[]): string {
  const [first] = dayPhotos;
  return first ? format(first.takenAt, "MMM") : "";
}

/** The timeline label of the days the photos were taken, or "" without one. */
function dayLabel(dayPhotos: Photo[]): string {
  const [first] = dayPhotos;
  return first ? labelOn(dayKey(first.takenAt)) : "";
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
