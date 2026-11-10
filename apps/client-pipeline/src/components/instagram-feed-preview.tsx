import { Link } from "@tanstack/react-router";
import { CalendarDaysIcon, CircleCheckIcon, ClockIcon, ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { longDayFormat, parseIsoDate } from "@/lib/calendar";
import { offlineImageUrl } from "@/lib/offline-thumbnails";
import { type FeedEntry, type FeedPhoto, feedAsOf, feedEntries } from "@/lib/social-feed";
import type { DayPost } from "@/lib/social-post-days";
import { photoName } from "@/lib/social-schedule";
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
export function InstagramFeedPreview({ byDay, posts, today }: InstagramFeedPreviewProps) {
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
        <AsOfPicker asOf={asOf} today={today} onChange={setAsOf} />
      </div>
      <p className="text-muted-foreground text-sm">
        Your Instagram grid as it looks at the end of {longDayFormat.format(parseIsoDate(asOf))}:{" "}
        {feed.length} {feed.length === 1 ? "post" : "posts"}, newest first, from the calendar and
        the Instagram posts under <strong>Social media posts</strong>, with changes not committed
        yet. Photos that post on that day are ringed.
      </p>
      <FeedGrid feed={feed.slice(0, shown)} asOf={asOf} today={today} />
      {feed.length > shown && (
        <Button variant="outline" className="self-center" onClick={() => setShown(shown + PAGE)}>
          Show more ({feed.length - shown} left)
        </Button>
      )}
    </section>
  );
}

interface AsOfPickerProps {
  asOf: string;
  today: string;
  onChange: (day: string) => void;
}

/** The day the preview shows the feed on, with a button back to today. Clearing it goes to today. */
function AsOfPicker({ asOf, today, onChange }: AsOfPickerProps) {
  return (
    <div className="flex items-center gap-1">
      <DatePicker
        value={asOf}
        onChange={(day) => onChange(day || today)}
        aria-label="Show the feed as of"
        className="w-52"
      />
      <Button variant="outline" disabled={asOf === today} onClick={() => onChange(today)}>
        Today
      </Button>
    </div>
  );
}

interface FeedGridProps {
  feed: FeedEntry[];
  asOf: string;
  today: string;
}

/** The feed as Instagram's profile grid: three columns of 3:4 tiles with thin gaps. */
function FeedGrid({ feed, asOf, today }: FeedGridProps) {
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
}

/** One photo of the feed, linking to its Photo page, with its day and where it stands on hover. */
function FeedTile({ entry, asOf, upcoming }: FeedTileProps) {
  const day = longDayFormat.format(parseIsoDate(entry.day));
  const label = `${entry.name}, ${day}: ${SOURCE_LABELS[entry.source]}`;
  return (
    <li className="relative aspect-[3/4]">
      <Link
        to="/exif"
        search={{ edit: entry.path }}
        title={label}
        aria-label={label}
        className="bg-muted block size-full overflow-hidden"
      >
        <TileImage image={entry.image} />
        {entry.day === asOf && (
          <span className="ring-primary pointer-events-none absolute inset-0 ring-2 ring-inset" />
        )}
        <SourceMark entry={entry} upcoming={upcoming} />
      </Link>
    </li>
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
        "pointer-events-none absolute top-1 right-1 rounded p-0.5",
        entry.source === "scheduled" ? "bg-emerald-600 text-white" : "bg-background/85",
      )}
    >
      <Icon className="size-3" aria-hidden />
    </span>
  );
}
