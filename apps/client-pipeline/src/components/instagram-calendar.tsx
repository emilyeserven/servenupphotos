import { ChevronLeftIcon, ChevronRightIcon, ImageIcon, PlusIcon } from "lucide-react";
import { type DragEvent, type ReactNode, useMemo, useState } from "react";
import type { SocialCalendar, SocialPhoto } from "@/api/publish";
import { DraftBadge } from "@/components/draft-mark";
import { PhotoFiles } from "@/components/photo-files";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { calendarDays, isoDate, parseIsoDate } from "@/lib/calendar";
import { isDraft, useUntitledDrafts } from "@/lib/drafts";
import {
  type Unsaved,
  PUBLISH_DATE,
  dateChanges,
  dateOf,
  moveToDay,
  photoName,
  photosByDay,
  pickerChoices,
  unsavedFromEdits,
} from "@/lib/social-schedule";
import { cn } from "@/lib/utils";
import { useLocalEditsStore } from "@/stores/local-edits";

/** How many weeks the calendar shows, this week first. */
const WEEKS = 3;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The type the dragged photo's file path is carried under. */
const DRAG_TYPE = "application/x-photo-path";

const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const longDayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

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
  return <PhotoFiles>{(data) => <Schedule calendar={data} />}</PhotoFiles>;
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

function Schedule({ calendar }: { calendar: SocialCalendar }) {
  const { unsaved, update } = useUnsavedDates(calendar.photos);
  const [weekOffset, setWeekOffset] = useState(0);
  const [picking, setPicking] = useState<string | null>(null);
  // Read the clock once, so the calendar doesn't shift under a drag at midnight.
  const [now] = useState(() => new Date());

  const byDay = photosByDay(calendar.photos, unsaved);
  const schedule = (photo: SocialPhoto, day: string | null) =>
    update(moveToDay(unsaved, byDay, photo, day));

  return (
    <div className="flex flex-col gap-4">
      <SourceNote calendar={calendar} />
      <CalendarGrid
        days={calendarDays(now, weekOffset, WEEKS)}
        today={isoDate(now)}
        weekOffset={weekOffset}
        onWeekOffset={setWeekOffset}
        byDay={byDay}
        unsaved={unsaved}
        onOpen={setPicking}
        onDropPhoto={(path, day) => {
          const dropped = calendar.photos.find((p) => p.path === path);
          if (dropped) schedule(dropped, day);
        }}
      />
      <PhotoPicker
        day={picking}
        byDay={byDay}
        photos={calendar.photos}
        unsaved={unsaved}
        onClose={() => setPicking(null)}
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

/** Where the photos come from, and anything that keeps saving from working. */
function SourceNote({ calendar }: { calendar: SocialCalendar }) {
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
  unsaved: Unsaved;
  onOpen: (day: string) => void;
  onDropPhoto: (path: string, day: string) => void;
}

function CalendarGrid(props: CalendarGridProps) {
  const { days, today, byDay, unsaved, onOpen, onDropPhoto } = props;
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
              unsaved={
                photo !== undefined && dateOf(unsaved, photo) !== photo.socialMediaPublishDate
              }
              onOpen={() => onOpen(day)}
              onDropPhoto={(path) => onDropPhoto(path, day)}
            />
          );
        })}
      </div>
      <p className="text-muted-foreground text-sm">
        Click an empty day to pick a photo for it, or a photo to change or remove it. Drag a photo
        to another day to move it there; dropping it on another photo swaps the two.
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
  /** Whether the photo on this day isn't saved there yet. */
  unsaved: boolean;
  onOpen: () => void;
  onDropPhoto: (path: string) => void;
}

/** Drag handlers that take a photo dropped on a day, and whether one is being dragged over it. */
function useDropTarget(onDropPhoto: (path: string) => void) {
  const [over, setOver] = useState(false);
  const handlers = {
    onDragOver: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setOver(true);
    },
    onDragLeave: (event: DragEvent) => {
      // Moving onto the day's own button or image isn't leaving it.
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setOver(false);
      const path = event.dataTransfer.getData(DRAG_TYPE);
      if (path) onDropPhoto(path);
    },
  };
  return { over, handlers };
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
function Day({ day, today, photo, unsaved, onOpen, onDropPhoto }: DayProps) {
  const { over, handlers } = useDropTarget(onDropPhoto);
  const label = longDayFormat.format(parseIsoDate(day));
  return (
    <div role="gridcell" className={dayClass(day, today, over)} {...handlers}>
      <DayNumber day={day} today={today} onPhoto={photo !== undefined} />
      {photo ? (
        <ScheduledPhoto photo={photo} label={label} unsaved={unsaved} onOpen={onOpen} />
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex size-full items-center justify-center transition-colors"
          aria-label={`${label}: pick a photo`}
        >
          <PlusIcon className="size-4" />
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
        event.dataTransfer.setData(DRAG_TYPE, photo.path);
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

function PhotoImage({ photo }: { photo: SocialPhoto }) {
  if (!photo.image) {
    return (
      <span className="bg-muted text-muted-foreground flex size-full items-center justify-center">
        <ImageIcon className="size-5" />
      </span>
    );
  }
  return (
    <img
      src={photo.image}
      alt=""
      draggable={false}
      loading="lazy"
      className="size-full object-cover"
    />
  );
}

interface PhotoPickerProps {
  /** The day being picked for, or null when the picker is closed. */
  day: string | null;
  byDay: Map<string, SocialPhoto>;
  photos: SocialPhoto[];
  unsaved: Unsaved;
  onClose: () => void;
  /** Puts photo on day, or takes it off the calendar when day is null. */
  onSchedule: (photo: SocialPhoto, day: string | null) => void;
}

/** Picks a photo for a day, or takes the day's photo off it. */
function PhotoPicker({ day, byDay, photos, unsaved, onClose, onSchedule }: PhotoPickerProps) {
  const [search, setSearch] = useState("");
  // Kept between days, so opting in once shows them every time the picker opens.
  const [showScheduled, setShowScheduled] = useState(false);
  const current = day === null ? undefined : byDay.get(day);
  /** Clears the search for the next day before closing. */
  const close = () => {
    setSearch("");
    onClose();
  };
  const choose = (photo: SocialPhoto, to: string | null) => {
    setSearch("");
    onSchedule(photo, to);
  };

  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <PickerHeader day={day} current={current} />
        <Input
          type="search"
          placeholder="Search by title or file name"
          aria-label="Search photos"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={showScheduled}
            onChange={(event) => setShowScheduled(event.target.checked)}
          />
          Show already scheduled photos
        </label>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <PickerChoices
            choices={pickerChoices(photos, unsaved, search, showScheduled)}
            searching={search.trim() !== ""}
            hidingScheduled={!showScheduled && photos.some((p) => dateOf(unsaved, p) !== null)}
            current={current}
            unsaved={unsaved}
            onPick={(photo) => choose(photo, day)}
          />
        </div>
        {current && (
          <DialogFooter>
            <Button variant="outline" onClick={() => choose(current, null)}>
              Remove from this day
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PickerHeader({ day, current }: { day: string | null; current: SocialPhoto | undefined }) {
  const intro = current
    ? `${photoName(current)} is posted this day. Pick another photo to swap it out.`
    : "Pick a photo to post this day.";
  return (
    <DialogHeader>
      <DialogTitle>{day ? longDayFormat.format(parseIsoDate(day)) : ""}</DialogTitle>
      <DialogDescription>{intro} A photo already on another day moves here.</DialogDescription>
    </DialogHeader>
  );
}

interface PickerChoicesProps {
  choices: SocialPhoto[];
  searching: boolean;
  /** Whether scheduled photos are left out, so an empty list can say so. */
  hidingScheduled: boolean;
  current: SocialPhoto | undefined;
  unsaved: Unsaved;
  onPick: (photo: SocialPhoto) => void;
}

/** What an empty list of choices says. */
function noChoices(searching: boolean, hidingScheduled: boolean): string {
  if (searching) return hidingScheduled ? "No unscheduled photos match." : "No photos match.";
  return hidingScheduled ? "Every photo is already scheduled." : "There are no photo files yet.";
}

function PickerChoices(props: PickerChoicesProps) {
  const { choices, searching, hidingScheduled, current, unsaved, onPick } = props;
  if (choices.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        {noChoices(searching, hidingScheduled)}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {choices.map((photo) => (
        <li key={photo.path}>
          <PickerChoice
            photo={photo}
            scheduled={dateOf(unsaved, photo)}
            isCurrent={photo.path === current?.path}
            onPick={() => onPick(photo)}
          />
        </li>
      ))}
    </ul>
  );
}

interface PickerChoiceProps {
  photo: SocialPhoto;
  /** The day the photo is on now, if any. */
  scheduled: string | null;
  isCurrent: boolean;
  onPick: () => void;
}

const BADGE = "rounded px-1 text-[10px] font-medium";

/** Whether the photo is eligible for social media, and whether it's a draft or still in flight. */
function PhotoBadges({ photo }: { photo: SocialPhoto }) {
  return (
    <span className="absolute top-1 left-1 flex flex-wrap gap-1">
      {photo.isSocialMediaEligible && (
        <span className={cn(BADGE, "bg-background/85")}>Eligible</span>
      )}
      <DraftBadge data={photo.data} className={cn(BADGE, "bg-violet-600 text-white")}>
        {!photo.inAllPhotos && <span className={cn(BADGE, "bg-background/85")}>In flight</span>}
      </DraftBadge>
    </span>
  );
}

function PickerChoice({ photo, scheduled, isCurrent, onPick }: PickerChoiceProps) {
  return (
    <button
      type="button"
      disabled={isCurrent}
      onClick={onPick}
      className="group focus-visible:ring-ring flex w-full flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-2 disabled:opacity-50"
    >
      <span className="relative aspect-square overflow-hidden rounded-md border">
        <PhotoImage photo={photo} />
        <PhotoBadges photo={photo} />
        {scheduled && (
          <span
            className={cn(BADGE, "bg-primary text-primary-foreground absolute right-1 bottom-1")}
          >
            {isCurrent ? "This day" : dayFormat.format(parseIsoDate(scheduled))}
          </span>
        )}
      </span>
      <span className="truncate text-xs group-hover:underline">{photoName(photo)}</span>
    </button>
  );
}
