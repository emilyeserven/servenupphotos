import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type { SocialCalendar, SocialPhoto } from "@/api/publish";
import { DayPostBackdrop, DayPostMark, InstagramPosts } from "@/components/instagram-posts";
import { InstagramFeedPreview } from "@/components/instagram-feed-preview";
import { InstagramFocus } from "@/components/instagram-focus";
import { AnchorOutline, GridAnchorControls, useGridAnchors } from "@/components/grid-anchor";
import { type AnchorPlace, anchorGroups, anchorPlaces } from "@/lib/grid-anchors";
import { ScheduleTabs } from "@/components/instagram-tabs";
import { PhotoImage, PhotoPicker } from "@/components/instagram-photo-picker";
import { PhotoFiles } from "@/components/photo-files";
import { Button } from "@/components/ui/button";
import { calendarDays, dayFormat, isoDate, longDayFormat, parseIsoDate } from "@/lib/calendar";
import { isDraft, useUntitledDrafts } from "@/lib/drafts";
import {
  PHOTO_DRAG_TYPE,
  type Unsaved,
  dateChanges,
  dateOf,
  moveToDay,
  photoName,
  photosByDay,
  unsavedFromEdits,
  withoutUndecided,
} from "@/lib/social-schedule";
import { useDropTarget } from "@/hooks/use-drop-target";
import { cn } from "@/lib/utils";
import { type DayPost, instagramPostsByDay } from "@/lib/social-post-days";
import { useChangedPhotoFiles } from "@/stores/combined-data";
import { useLocalEditsStore } from "@/stores/local-edits";
import { PUBLISH_DATE } from "@/lib/photo-fields";

/** How many weeks the calendar shows, this week first. */
const WEEKS = 3;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "1 photo", "2 photos". */
function count(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`;
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      {children}
    </a>
  );
}

/** Schedules photos to post to Instagram, one a day, on a calendar of the coming weeks. */
export function InstagramCalendar() {
  return <PhotoFiles>{(data) => <DecidedSchedule calendar={data} />}</PhotoFiles>;
}

/** The calendar without the photos set aside as Undecided, which the page doesn't show. */
function DecidedSchedule({ calendar }: { calendar: SocialCalendar }) {
  const changed = useChangedPhotoFiles();
  const { photos, undecided } = useMemo(
    () => withoutUndecided(calendar.photos, changed),
    [calendar.photos, changed],
  );
  return <Schedule calendar={{ ...calendar, photos }} undecided={undecided} />;
}

/**
 * The dates moved on the calendar and not committed yet, kept with the app's other local edits so
 * the sync button counts them and **Commit** saves them.
 */
function useUnsavedDates(photos: SocialPhoto[]) {
  const edits = useLocalEditsStore((state) => state.edits);
  const setField = useLocalEditsStore((state) => state.setField);
  const unsaved = useMemo(() => unsavedFromEdits(edits), [edits]);
  const update = (next: Unsaved) => setField(PUBLISH_DATE, dateChanges(photos, next));
  return { unsaved, update };
}

/**
 * Each day's Instagram posts from the photos' Social media posts, gallery and in flight photos
 * alike, with the changes the app keeps for Commit made over the files read for the calendar.
 */
function useInstagramPosts(photos: SocialPhoto[]) {
  const changed = useChangedPhotoFiles();
  return useMemo(() => instagramPostsByDay(photos, changed), [photos, changed]);
}

function Schedule({ calendar, undecided }: { calendar: SocialCalendar; undecided: number }) {
  const { unsaved, update } = useUnsavedDates(calendar.photos);
  const posts = useInstagramPosts(calendar.photos);
  const [weekOffset, setWeekOffset] = useState(0);
  const [picking, setPicking] = useState<string | null>(null);
  // Read the clock once, so the calendar doesn't shift under a drag at midnight.
  const [now] = useState(() => new Date());

  const byDay = photosByDay(calendar.photos, unsaved);
  const anchors = useGridAnchors(calendar.photos);
  const groups = anchorGroups(byDay, anchors.anchors);
  const places = anchorPlaces(groups);
  const days = calendarDays(now, weekOffset, WEEKS);
  const schedule = (photo: SocialPhoto, day: string | null) =>
    update(moveToDay(unsaved, byDay, photo, day));
  const dropPhoto = (path: string, day: string) => {
    const dropped = calendar.photos.find((p) => p.path === path);
    if (dropped) schedule(dropped, day);
  };

  return (
    <div className="flex flex-col gap-4">
      <SourceNote calendar={calendar} undecided={undecided} />
      <InstagramFocus photos={calendar.photos} />
      <ScheduleTabs
        calendar={
          <>
            <CalendarGrid
              days={days}
              today={isoDate(now)}
              weekOffset={weekOffset}
              onWeekOffset={setWeekOffset}
              byDay={byDay}
              posts={posts}
              unsaved={unsaved}
              onOpen={setPicking}
              onDropPhoto={dropPhoto}
              places={places}
            />
            <InstagramPosts postsByDay={posts} today={isoDate(now)} />
          </>
        }
        feed={
          <InstagramFeedPreview
            byDay={byDay}
            posts={posts}
            today={isoDate(now)}
            onDropPhoto={dropPhoto}
            places={places}
          />
        }
      />
      <PhotoPicker
        day={picking}
        byDay={byDay}
        photos={calendar.photos}
        unsaved={unsaved}
        onClose={() => setPicking(null)}
        footer={(photo) => (
          <GridAnchorControls
            name={
              anchors.anchors.has(photo.path) ? (anchors.anchors.get(photo.path) ?? "") : undefined
            }
            onToggle={() => anchors.toggle(photo)}
            onRename={(name) => anchors.rename(photo, name)}
          />
        )}
        onSchedule={(photo, day) => {
          schedule(photo, day);
          setPicking(null);
        }}
      />
    </div>
  );
}

/**
 * How many of photos are drafts, with untitled photos kept as drafts, and how many others are in
 * flight, not in ALLPHOTOS.json on the base branch yet.
 */
function photoCounts(photos: SocialPhoto[], untitledDrafts: boolean) {
  const draft = (photo: SocialPhoto) => untitledDrafts && isDraft(photo.data);
  return {
    drafts: photos.filter(draft).length,
    inFlight: photos.filter((photo) => !photo.inAllPhotos && !draft(photo)).length,
  };
}

/** ", and N drafts…" after the photo counts, when there are any. */
function DraftCount({ drafts }: { drafts: number }) {
  if (drafts === 0) return null;
  return <>, and {count(drafts, "draft")} without a title, which the portfolio doesn't show</>;
}

/** " Undecided photos (N) aren't shown." after the photo counts, when there are any. */
function UndecidedCount({ undecided }: { undecided: number }) {
  if (undecided === 0) return null;
  return (
    <> {count(undecided, "Undecided photo")} set aside on Photos in Flight aren&apos;t shown.</>
  );
}

/** Where the photos come from, and anything that keeps saving from working. */
function SourceNote({ calendar, undecided }: { calendar: SocialCalendar; undecided: number }) {
  const { pullRequest } = calendar;
  const { inFlight, drafts } = photoCounts(calendar.photos, useUntitledDrafts());
  return (
    <div className="text-muted-foreground flex flex-col gap-1 text-sm">
      <p>
        Photos to pick from are the {count(calendar.photos.length, "photo file")} on{" "}
        <code>{calendar.branch}</code>
        {pullRequest && (
          <>
            {" "}
            (<ExternalLink href={pullRequest.url}>pull request #{pullRequest.number}</ExternalLink>)
          </>
        )}
        , {inFlight} of them in flight and not in <AllPhotosName calendar={calendar} /> on the base
        branch yet
        <DraftCount drafts={drafts} />. Moving a photo is kept in the app until you{" "}
        <strong>Commit</strong> from the sync button at the top right, which saves the dates to the
        same files.
        <UndecidedCount undecided={undecided} />
      </p>
      <Unreadable calendar={calendar} />
    </div>
  );
}

function AllPhotosName({ calendar: { allPhotos } }: { calendar: SocialCalendar }) {
  if (!allPhotos.fileUrl) return <code>ALLPHOTOS.json</code>;
  return <ExternalLink href={allPhotos.fileUrl}>ALLPHOTOS.json</ExternalLink>;
}

function Unreadable({ calendar: { unreadable } }: { calendar: SocialCalendar }) {
  if (unreadable.length === 0) return null;
  return (
    <p className="text-destructive">
      {count(unreadable.length, "photo file")} couldn&apos;t be read, so nothing can be committed:{" "}
      {unreadable.map((f) => `${f.path} (${f.error})`).join(", ")}
    </p>
  );
}

interface CalendarGridProps {
  days: string[];
  today: string;
  weekOffset: number;
  onWeekOffset: (offset: number) => void;
  byDay: Map<string, SocialPhoto>;
  /** Each day's posts from the photos' Social media posts. */
  posts: Map<string, DayPost[]>;
  unsaved: Unsaved;
  onOpen: (day: string) => void;
  onDropPhoto: (path: string, day: string) => void;
  /** Where each photo in a Grid Anchor group stands, by file path. */
  places: Map<string, AnchorPlace>;
}

function CalendarGrid(props: CalendarGridProps) {
  const { days, today, byDay, posts, unsaved, onOpen, onDropPhoto, places } = props;
  return (
    <>
      <WeekNav {...props} />
      <div className="grid grid-cols-7 gap-1 sm:gap-2" role="grid" aria-label="Instagram calendar">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="text-muted-foreground text-center text-xs font-medium">
            {weekday}
          </div>
        ))}
        {days.map((day) => {
          const photo = byDay.get(day);
          return (
            <Day
              key={day}
              day={day}
              today={today}
              photo={photo}
              posts={posts.get(day)}
              unsaved={
                photo !== undefined && dateOf(unsaved, photo) !== photo.socialMediaPublishDate
              }
              onOpen={() => onOpen(day)}
              onDropPhoto={(path) => onDropPhoto(path, day)}
              place={photo && places.get(photo.path)}
            />
          );
        })}
      </div>
      <p className="text-muted-foreground text-sm">
        Click an empty day to pick a photo for it, or a photo to change or remove it. Drag a photo
        to another day to move it there; dropping it on another photo swaps the two. A check in a
        day&apos;s corner marks Instagram posts already scheduled on Instagram, and a clock ones
        still planned. A Grid Anchor (set in a day&apos;s picker) and the 2 photos before it are
        outlined in their color: they make one row of the Social Feed.
      </p>
    </>
  );
}

/** The days shown, with buttons to page a week at a time. */
function WeekNav({ days, today, weekOffset, onWeekOffset }: CalendarGridProps) {
  const first = parseIsoDate(days[0] ?? today);
  const last = parseIsoDate(days.at(-1) ?? today);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-medium">
        {dayFormat.format(first)} – {dayFormat.format(last)}
      </h2>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Earlier week"
          onClick={() => onWeekOffset(weekOffset - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button variant="outline" disabled={weekOffset === 0} onClick={() => onWeekOffset(0)}>
          This week
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Later week"
          onClick={() => onWeekOffset(weekOffset + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

interface DayProps {
  day: string;
  today: string;
  photo: SocialPhoto | undefined;
  /** The day's posts from the photos' Social media posts, if any. */
  posts: DayPost[] | undefined;
  /** Whether the photo on this day isn't saved there yet. */
  unsaved: boolean;
  onOpen: () => void;
  onDropPhoto: (path: string) => void;
  /** Where the day's photo stands in a Grid Anchor group, if it's in one. */
  place: AnchorPlace | undefined;
}

/** A day's box: dimmed in the past, ringed today and while a photo is dragged over it. */
function dayClass(day: string, today: string, over: boolean) {
  return cn(
    "relative flex aspect-square flex-col overflow-hidden rounded-md border",
    day < today && "opacity-60",
    day === today && "border-primary ring-primary/40 ring-2",
    over && "ring-ring ring-2",
  );
}

/** One day of the calendar: a drop target holding its photo, or a button to pick one. */
function Day({ day, today, photo, posts, unsaved, onOpen, onDropPhoto, place }: DayProps) {
  const { over, handlers } = useDropTarget(PHOTO_DRAG_TYPE, onDropPhoto);
  const label = longDayFormat.format(parseIsoDate(day));
  return (
    <div role="gridcell" className={dayClass(day, today, over)} {...handlers}>
      <DayNumber
        day={day}
        today={today}
        onPhoto={photo !== undefined || !!posts?.[0]?.photo.image}
      />
      <DayPostMark posts={posts} />
      <AnchorOutline place={place} />
      {photo ? (
        <ScheduledPhoto photo={photo} label={label} unsaved={unsaved} onOpen={onOpen} />
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground relative flex size-full items-center justify-center transition-colors"
          aria-label={`${label}: pick a photo`}
        >
          <DayPostBackdrop posts={posts} />
          <PlusIcon className="relative size-4" />
        </button>
      )}
    </div>
  );
}

/** The day of the month, with the month on the 1st and today. */
function DayNumber({ day, today, onPhoto }: { day: string; today: string; onPhoto: boolean }) {
  const date = parseIsoDate(day);
  const withMonth = date.getDate() === 1 || day === today;
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-0.5 left-0.5 z-10 rounded px-1 text-[10px] font-medium whitespace-nowrap sm:top-1 sm:left-1 sm:text-xs",
        onPhoto ? "bg-background/80" : "text-muted-foreground",
      )}
    >
      {withMonth ? dayFormat.format(date) : date.getDate()}
    </span>
  );
}

interface ScheduledPhotoProps {
  photo: SocialPhoto;
  label: string;
  unsaved: boolean;
  onOpen: () => void;
}

/** A day's photo, which can be dragged to another day or clicked to change. */
function ScheduledPhoto({ photo, label, unsaved, onOpen }: ScheduledPhotoProps) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(PHOTO_DRAG_TYPE, photo.path);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      className="size-full cursor-grab active:cursor-grabbing"
      aria-label={`${label}: ${photoName(photo)}. Change or remove`}
      title={photoName(photo)}
    >
      <PhotoImage photo={photo} />
      {unsaved && (
        <span className="bg-primary absolute right-1 bottom-1 size-2 rounded-full">
          <span className="sr-only">Not saved</span>
        </span>
      )}
    </button>
  );
}
