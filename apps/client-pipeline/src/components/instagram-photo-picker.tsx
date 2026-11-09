import { ImageIcon, SparklesIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { DraftBadge } from "@/components/draft-mark";
import { focusSummary } from "@/components/instagram-focus";
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
import { PickerSection, peekClass } from "@/components/picker-section";
import { dayFormat, longDayFormat, parseIsoDate } from "@/lib/calendar";
import { offlineImageUrl } from "@/lib/offline-thumbnails";
import { type Unsaved, dateOf, photoName, pickerChoices } from "@/lib/social-schedule";
import { type SocialFocus, isFocused, matchesFocus } from "@/lib/social-focus";
import { type Neighbors, neighborsFor } from "@/lib/social-neighbors";
import { type Suggestion, suggestionsFor } from "@/lib/social-suggestions";
import { cn } from "@/lib/utils";
import { useChangedPhotoFiles } from "@/stores/combined-data";
import { useSocialFocusStore } from "@/stores/social-focus";

/** A photo's Square Thumbnail, or an icon when it has no image. */
export function PhotoImage({ photo }: { photo: SocialPhoto }) {
  if (!photo.image) {
    return (
      <span className="bg-muted text-muted-foreground flex size-full items-center justify-center">
        <ImageIcon className="size-5" />
      </span>
    );
  }
  return (
    <img
      src={offlineImageUrl(photo.image)}
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

/** The photo on day, if the picker is open and the day has one. */
function dayPhoto(byDay: Map<string, SocialPhoto>, day: string | null): SocialPhoto | undefined {
  return day === null ? undefined : byDay.get(day);
}

/**
 * The unused photos most like the ones on the days before day; none when day is null, while the
 * picker is closed or something is searched for.
 */
function useSuggestions(
  photos: SocialPhoto[],
  unsaved: Unsaved,
  day: string | null,
  allowed: (photo: SocialPhoto) => boolean,
) {
  const changed = useChangedPhotoFiles();
  return useMemo(
    () => (day === null ? [] : suggestionsFor(photos, unsaved, day, changed, allowed)),
    [photos, unsaved, day, changed, allowed],
  );
}

/**
 * The photos taken around the last photo on the calendar before day; null when day is null, while
 * the picker is closed or something is searched for.
 */
function useNeighbors(
  photos: SocialPhoto[],
  unsaved: Unsaved,
  day: string | null,
  allowed: (photo: SocialPhoto) => boolean,
) {
  const changed = useChangedPhotoFiles();
  return useMemo(
    () => (day === null ? null : neighborsFor(photos, unsaved, day, changed, allowed)),
    [photos, unsaved, day, changed, allowed],
  );
}

/** The paths of the photos taken around the last scheduled one. */
function neighborPaths(neighbors: Neighbors | null): Set<string> {
  return new Set(neighbors?.photos.map(({ photo }) => photo.path));
}

/**
 * What the picker suggests for day: the photos taken around the last scheduled one, the most alike
 * photos that aren't among them, and whether there are any.
 */
function useSuggested(
  photos: SocialPhoto[],
  unsaved: Unsaved,
  day: string | null,
  allowed: (photo: SocialPhoto) => boolean,
) {
  const neighbors = useNeighbors(photos, unsaved, day, allowed);
  const similar = useSuggestions(photos, unsaved, day, allowed);
  const inOrder = neighborPaths(neighbors);
  const shown = similar.filter(({ photo }) => !inOrder.has(photo.path));
  return { neighbors, shown, any: shown.length > 0 || inOrder.size > 0 };
}

/**
 * The Focus the picker filters by, and whether it's turned off for this pick; it's on again each
 * time the picker opens.
 */
function useFocus() {
  const focus = useSocialFocusStore((state) => state.focus);
  const [ignored, setIgnored] = useState(false);
  const on = isFocused(focus) && !ignored;
  const allowed = useMemo(
    () => (on ? (photo: SocialPhoto) => matchesFocus(photo, focus) : () => true),
    [on, focus],
  );
  return { focus, ignored, setIgnored, allowed, focused: on };
}

/** The choices the Focus allows, without the ones suggested above them. */
function otherChoices(
  choices: SocialPhoto[],
  suggestions: Suggestion[],
  neighbors: Neighbors | null,
  allowed: (photo: SocialPhoto) => boolean,
): SocialPhoto[] {
  const suggested = neighborPaths(neighbors);
  for (const { photo } of suggestions) suggested.add(photo.path);
  return choices.filter((photo) => !suggested.has(photo.path) && allowed(photo));
}

/** The box that adds photos already on the calendar to the list. */
function ShowScheduledToggle(props: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      Show already scheduled photos
    </label>
  );
}

interface FocusToggleProps {
  focus: SocialFocus;
  ignored: boolean;
  onIgnored: (ignored: boolean) => void;
}

/** The Focus the picker is filtering by, with a box to show every photo this time. */
function FocusToggle({ focus, ignored, onIgnored }: FocusToggleProps) {
  if (!isFocused(focus)) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={!ignored}
        onChange={(event) => onIgnored(!event.target.checked)}
      />
      <span>
        Focus: <span className="text-muted-foreground">{focusSummary(focus)}</span>
      </span>
    </label>
  );
}

/**
 * Picks a photo for a day, or takes the day's photo off it. **Before and after** comes first, with
 * the photos taken around the last scheduled one before the day, then **Suggested**, with photos
 * like the 3 before it.
 */
export function PhotoPicker({
  day,
  byDay,
  photos,
  unsaved,
  onClose,
  onSchedule,
}: PhotoPickerProps) {
  const [search, setSearch] = useState("");
  // Kept between days, so opting in once shows them every time the picker opens.
  const [showScheduled, setShowScheduled] = useState(false);
  const current = dayPhoto(byDay, day);
  const { focus, ignored, setIgnored, allowed, focused } = useFocus();
  const searching = search.trim() !== "";
  const { neighbors, shown, any } = useSuggested(photos, unsaved, searching ? null : day, allowed);
  const choices = otherChoices(
    pickerChoices(photos, unsaved, search, showScheduled),
    shown,
    neighbors,
    allowed,
  );
  /** Clears the search for the next day before closing. */
  const reset = () => {
    setSearch("");
    setIgnored(false);
  };
  const close = () => {
    reset();
    onClose();
  };
  const choose = (photo: SocialPhoto, to: string | null) => {
    reset();
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
        <ShowScheduledToggle checked={showScheduled} onChange={setShowScheduled} />
        <FocusToggle focus={focus} ignored={ignored} onIgnored={setIgnored} />
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          <NeighborChoices
            neighbors={neighbors}
            unsaved={unsaved}
            current={current}
            onPick={(photo) => choose(photo, day)}
          />
          <SuggestedChoices suggestions={shown} onPick={(photo) => choose(photo, day)} />
          <PickerChoices
            choices={choices}
            titled={any}
            focused={focused}
            searching={searching}
            hidingScheduled={!showScheduled && photos.some((p) => dateOf(unsaved, p) !== null)}
            current={current}
            unsaved={unsaved}
            onPick={(photo) => choose(photo, day)}
          />
        </div>
        {current && <RemoveFooter onRemove={() => choose(current, null)} />}
      </DialogContent>
    </Dialog>
  );
}

/** The button that takes the day's photo off the calendar. */
function RemoveFooter({ onRemove }: { onRemove: () => void }) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onRemove}>
        Remove from this day
      </Button>
    </DialogFooter>
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

/** How far a suggestion is from the photos before the day, such as "3 km away" or "Same place". */
function placeReason({ km, samePlace }: Suggestion): string | null {
  if (km !== null) return km < 1 ? "Same spot" : `${Math.round(km).toLocaleString()} km away`;
  return samePlace ? "Same place" : null;
}

/** How far apart in time, such as "Same day" or "5 days apart". */
function dateReason({ days }: Suggestion): string | null {
  if (days === null) return null;
  return days === 0 ? "Same day" : `${days.toLocaleString()} ${days === 1 ? "day" : "days"} apart`;
}

function tagReason({ sharedTags }: Suggestion): string | null {
  if (sharedTags === 0) return null;
  return `${sharedTags} ${sharedTags === 1 ? "tag" : "tags"} in common`;
}

/** Why the photo is suggested, against the nearest of the photos before the day. */
function reasons(suggestion: Suggestion): string {
  return [placeReason(suggestion), dateReason(suggestion), tagReason(suggestion)]
    .filter(Boolean)
    .join(" · ");
}

/** Where a photo is from the last scheduled one, such as "2 before" or "1 after". */
function offsetReason(offset: number): string {
  return offset < 0 ? `${-offset} before` : `${offset} after`;
}

interface NeighborChoicesProps {
  neighbors: Neighbors | null;
  unsaved: Unsaved;
  current: SocialPhoto | undefined;
  onPick: (photo: SocialPhoto) => void;
}

/**
 * **Before and after**: the photos taken just before and after the last scheduled one, in the
 * order they were taken. Open at first; collapsed, it shows only its heading.
 */
function NeighborChoices({ neighbors, unsaved, current, onPick }: NeighborChoicesProps) {
  if (!neighbors || neighbors.photos.length === 0) return null;
  const { anchor, anchorDay } = neighbors;
  const description = `Taken just before and after ${photoName(anchor)}, the last photo scheduled before this day (${dayFormat.format(parseIsoDate(anchorDay))}).`;
  return (
    <PickerSection
      title="Before and after"
      description={description}
      count={neighbors.photos.length}
      defaultOpen
    >
      {(collapsed) =>
        !collapsed && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {neighbors.photos.map(({ photo, offset }) => (
              <li key={photo.path}>
                <PickerChoice
                  photo={photo}
                  scheduled={dateOf(unsaved, photo)}
                  isCurrent={photo.path === current?.path}
                  reason={offsetReason(offset)}
                  onPick={() => onPick(photo)}
                />
              </li>
            ))}
          </ul>
        )
      }
    </PickerSection>
  );
}

/**
 * **Suggested**: the unused photos most like the 3 before the day, with why each one is. Collapsed
 * at first, showing just its first row.
 */
function SuggestedChoices(props: {
  suggestions: Suggestion[];
  onPick: (photo: SocialPhoto) => void;
}) {
  const { suggestions, onPick } = props;
  if (suggestions.length === 0) return null;
  return (
    <PickerSection
      title="Suggested"
      icon={<SparklesIcon className="size-4" />}
      description="Unused photos most like the 3 before this day: taken nearby, around the same time, or sharing tags."
      count={suggestions.length}
      defaultOpen={false}
    >
      {(collapsed) => (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.photo.path} className={peekClass(collapsed, index)}>
              <PickerChoice
                photo={suggestion.photo}
                scheduled={null}
                isCurrent={false}
                reason={reasons(suggestion)}
                onPick={() => onPick(suggestion.photo)}
              />
            </li>
          ))}
        </ul>
      )}
    </PickerSection>
  );
}

interface PickerChoicesProps {
  choices: SocialPhoto[];
  /** Whether the list is under the suggestions, so it's headed "All photos". */
  titled: boolean;
  /** Whether the Focus is filtering the list. */
  focused: boolean;
  searching: boolean;
  /** Whether scheduled photos are left out, so an empty list can say so. */
  hidingScheduled: boolean;
  current: SocialPhoto | undefined;
  unsaved: Unsaved;
  onPick: (photo: SocialPhoto) => void;
}

/** What an empty list of choices says when the Focus is filtering it, or else noChoices. */
function emptyMessage(focused: boolean, searching: boolean, hidingScheduled: boolean): string {
  if (focused) return "No photos match the Focus. Untick it to see every photo this time.";
  return noChoices(searching, hidingScheduled);
}

/** What an empty list of choices says. */
function noChoices(searching: boolean, hidingScheduled: boolean): string {
  if (searching) return hidingScheduled ? "No unscheduled photos match." : "No photos match.";
  return hidingScheduled ? "Every photo is already scheduled." : "There are no photo files yet.";
}

function PickerChoices(props: PickerChoicesProps) {
  const { choices, titled, focused, searching, hidingScheduled, current, unsaved, onPick } = props;
  if (choices.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        {emptyMessage(focused, searching, hidingScheduled)}
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-2" aria-label="All photos">
      {titled && <h3 className="text-sm font-medium">All photos</h3>}
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
    </section>
  );
}

interface PickerChoiceProps {
  photo: SocialPhoto;
  /** The day the photo is on now, if any. */
  scheduled: string | null;
  isCurrent: boolean;
  /** Why a suggested photo is suggested. */
  reason?: string;
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

function PickerChoice({ photo, scheduled, isCurrent, reason, onPick }: PickerChoiceProps) {
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
      {reason && <span className="text-muted-foreground text-[11px] leading-tight">{reason}</span>}
    </button>
  );
}
