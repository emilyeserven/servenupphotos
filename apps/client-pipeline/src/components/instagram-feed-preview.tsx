import { Link } from "@tanstack/react-router";
import { CalendarDaysIcon, CircleCheckIcon, ClockIcon, ImageIcon } from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { FeedDayPicker } from "@/components/feed-day-picker";
import { Button } from "@/components/ui/button";
import { longDayFormat, parseIsoDate } from "@/lib/calendar";
import { offlineImageUrl } from "@/lib/offline-thumbnails";
import { type FeedEntry, type FeedPhoto, feedAsOf, feedEntries } from "@/lib/social-feed";
import type { DayPost } from "@/lib/social-post-days";
import { PHOTO_DRAG_TYPE, photoName } from "@/lib/social-schedule";
import { useDropTarget } from "@/hooks/use-drop-target";
import { AnchorOutline } from "@/components/grid-anchor";
import type { AnchorPlace } from "@/lib/grid-anchors";
import { cn } from "@/lib/utils";

/** How many tiles the preview shows before **Show more**: four rows of three. */
const PAGE = 12;

/** What each tile's corner mark says about where the photo stands. */
const SOURCE_LABELS: Record<FeedEntry["source"], string> = {
  calendar: "On the calendar",
  planned: "Planned post",
  scheduled: "Scheduled on Instagram",
};

const SOURCE_ICONS = {
  calendar: CalendarDaysIcon,
  planned: ClockIcon,
  scheduled: CircleCheckIcon,
};

interface InstagramFeedPreviewProps {
  /** Each calendar day's photo, with the dates moved and not committed yet. */
  byDay: Map<string, SocialPhoto>;
  /** Each day's posts from the photos' Social media posts. */
  posts: Map<string, DayPost[]>;
  /** Today, as YYYY-MM-DD. */
  today: string;
  /** Moves the calendar photo at path to day, swapping with the photo already there. */
  onDropPhoto: (path: string, day: string) => void;
  /** Where each photo in a Grid Anchor group stands, by file path. */
  places: Map<string, AnchorPlace>;
}

/** The calendar's photos as the feed needs them. */
function feedPhotos(byDay: Map<string, SocialPhoto>): Map<string, FeedPhoto> {
  return new Map(
    [...byDay].map(([day, photo]) => [
      day,
      { path: photo.path, name: photoName(photo), image: photo.image },
    ]),
  );
}

/**
 * The Social Feed preview: the Instagram profile grid as it looks on a chosen day, newest first,
 * from the calendar's photos and the Instagram posts under Social media posts.
 */
export function InstagramFeedPreview(props: InstagramFeedPreviewProps) {
  const { byDay, posts, today, onDropPhoto, places } = props;
  const [asOf, setAsOf] = useState(today);
  const [shown, setShown] = useState(PAGE);
  const entries = useMemo(() => feedEntries(feedPhotos(byDay), posts), [byDay, posts]);
  const feed = feedAsOf(entries, asOf);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="social-feed-preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="social-feed-preview" className="text-lg font-medium">
          Social Feed preview
        </h2>
        <FeedDayPicker day={asOf} today={today} onChange={setAsOf} />
      </div>
      <p className="text-muted-foreground text-sm">
        Your Instagram grid as it looks at the end of {longDayFormat.format(parseIsoDate(asOf))}:{" "}
        {feed.length} {feed.length === 1 ? "post" : "posts"}, newest first, from the calendar and
        the Instagram posts under <strong>Social media posts</strong>, with changes not committed
        yet. Photos that post on that day are ringed. The arrow buttons, or the left and right arrow
        keys, step a day at a time. Drag a calendar photo onto another tile to swap their days. Once
        there&apos;s a Grid Anchor, the calendar&apos;s photos are outlined in rows of 3 counted
        from it, dark and light blue by turns, as a reference for lining up rows.
      </p>
      <FeedGrid
        feed={feed.slice(0, shown)}
        places={places}
        asOf={asOf}
        today={today}
        byDay={byDay}
        onDropPhoto={onDropPhoto}
      />
      {feed.length > shown && (
        <Button variant="outline" className="self-center" onClick={() => setShown(shown + PAGE)}>
          Show more ({feed.length - shown} left)
        </Button>
      )}
    </section>
  );
}

interface FeedGridProps {
  feed: FeedEntry[];
  asOf: string;
  today: string;
  byDay: Map<string, SocialPhoto>;
  onDropPhoto: (path: string, day: string) => void;
  places: Map<string, AnchorPlace>;
}

/** The feed as Instagram's profile grid: three columns of 3:4 tiles with thin gaps. */
function FeedGrid({ feed, asOf, today, byDay, onDropPhoto, places }: FeedGridProps) {
  if (feed.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
        Nothing is on Instagram by this day.
      </p>
    );
  }
  return (
    <ul className="mx-auto grid w-full max-w-md grid-cols-3 gap-0.5" aria-label="Social Feed">
      {feed.map((entry) => (
        <FeedTile
          key={`${entry.day}-${entry.path}`}
          entry={entry}
          asOf={asOf}
          upcoming={entry.day > today}
          onCalendar={byDay.get(entry.day)?.path === entry.path}
          onDropPhoto={(path) => onDropPhoto(path, entry.day)}
          place={places.get(entry.path)}
        />
      ))}
    </ul>
  );
}

interface FeedTileProps {
  entry: FeedEntry;
  asOf: string;
  /** Whether its day is after today, so it isn't on Instagram yet. */
  upcoming: boolean;
  /** Whether the photo is on the calendar that day, so it can be dragged to another tile's day. */
  onCalendar: boolean;
  /** Moves the dragged calendar photo at path to this tile's day. */
  onDropPhoto: (path: string) => void;
  /** Where the photo stands in a Grid Anchor group, if it's in one. */
  place: AnchorPlace | undefined;
}

/**
 * One photo of the feed, linking to its Photo page, with its day and where it stands on hover. A
 * calendar photo can be dragged onto another tile, which moves it to that tile's day.
 */
function FeedTile(props: FeedTileProps) {
  const { entry, asOf, upcoming, onCalendar, onDropPhoto, place } = props;
  const { over, handlers } = useDropTarget(PHOTO_DRAG_TYPE, (path) => {
    if (path !== entry.path) onDropPhoto(path);
  });
  const day = longDayFormat.format(parseIsoDate(entry.day));
  const label = `${entry.name}, ${day}: ${SOURCE_LABELS[entry.source]}`;
  return (
    <li className="relative aspect-[3/4]" {...handlers}>
      <Link
        to="/exif"
        search={{ edit: entry.path }}
        title={label}
        aria-label={label}
        {...dragProps(entry.path, onCalendar)}
      >
        <TileImage image={entry.image} />
        <TileRing over={over} chosenDay={entry.day === asOf} />
        <AnchorOutline place={place} />
        <SourceMark entry={entry} upcoming={upcoming} />
      </Link>
    </li>
  );
}

/** What makes a tile draggable when its photo is on the calendar, and its look either way. */
function dragProps(path: string, onCalendar: boolean) {
  const className = "bg-muted block size-full overflow-hidden";
  if (!onCalendar) return { draggable: false, className };
  return {
    draggable: true,
    className: cn(className, "cursor-grab active:cursor-grabbing"),
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(PHOTO_DRAG_TYPE, path);
      event.dataTransfer.effectAllowed = "move";
    },
  };
}

/** The ring of a tile a photo is dragged over, or of one that posts on the chosen day. */
function TileRing({ over, chosenDay }: { over: boolean; chosenDay: boolean }) {
  if (!over && !chosenDay) return null;
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 ring-inset",
        over ? "ring-ring ring-4" : "ring-primary ring-2",
      )}
    />
  );
}

function TileImage({ image }: { image: string | null }) {
  if (!image) {
    return (
      <span className="text-muted-foreground flex size-full items-center justify-center">
        <ImageIcon className="size-5" />
      </span>
    );
  }
  return (
    <img
      src={offlineImageUrl(image)}
      alt=""
      draggable={false}
      loading="lazy"
      className="size-full object-cover"
    />
  );
}

/** The corner mark of a photo still to come: a clock, or a check once it's scheduled on Instagram. */
function SourceMark({ entry, upcoming }: { entry: FeedEntry; upcoming: boolean }) {
  if (!upcoming) return null;
  const Icon = SOURCE_ICONS[entry.source];
  return (
    <span
      className={cn(
        "pointer-events-none absolute right-1 bottom-1 rounded p-0.5",
        entry.source === "scheduled" ? "bg-emerald-600 text-white" : "bg-background/85",
      )}
    >
      <Icon className="size-3" aria-hidden />
    </span>
  );
}
