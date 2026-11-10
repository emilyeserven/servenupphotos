import { SparklesIcon } from "lucide-react";
import { createContext, useContext } from "react";
import type { SocialPhoto } from "@/api/publish";
import { DraftBadge } from "@/components/draft-mark";
import { focusSummary } from "@/components/instagram-focus";
import { PhotoImage } from "@/components/instagram-picker/photo-image";
import type { PickerPhotos } from "@/components/instagram-picker/use-picker-photos";
import { Input } from "@/components/ui/input";
import { PickerSection, peekClass } from "@/components/picker-section";
import { dayFormat, parseIsoDate } from "@/lib/calendar";
import { PHOTO_DRAG_TYPE, type Unsaved, dateOf, photoName } from "@/lib/social-schedule";
import { isFocused } from "@/lib/social-focus";
import type { Neighbors } from "@/lib/social-neighbors";
import type { Suggestion } from "@/lib/social-suggestions";
import { cn } from "@/lib/utils";

/**
 * Whether the lists are in the calendar's photo drawer: 3 photos wide at every size, and each
 * photo can be dragged onto a calendar day.
 */
const InDrawer = createContext(false);

/** Marks a drag that started in the drawer, so dropping it back there does nothing. */
export const DRAWER_DRAG_TYPE = "application/x-from-photo-drawer";

/** Shows the lists inside it the photo drawer's way: narrow, with photos to drag. */
export const InDrawerProvider = InDrawer.Provider;

/** The grid of photos: 3 wide, or 4 from the sm breakpoint in the dialog. */
function useGridClass(): string {
  return useContext(InDrawer) ? "grid grid-cols-3 gap-2" : "grid grid-cols-3 gap-2 sm:grid-cols-4";
}

/** Keeps a collapsed section's peek to the first row: 3 photos in the drawer. */
function usePeek(): (collapsed: boolean, index: number) => string | undefined {
  const inDrawer = useContext(InDrawer);
  return (collapsed, index) =>
    inDrawer && collapsed && index >= 3 ? "hidden" : peekClass(collapsed, index);
}

/** A checkbox with its label, as the picker's filters use. */
function Check(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      {props.label}
    </label>
  );
}

/**
 * The picker's filters: the search, the box that adds photos already on the calendar, and the
 * Focus with a box to show every photo for now.
 */
export function PickerFilters({ filters }: { filters: PickerPhotos["filters"] }) {
  const { search, setSearch, showScheduled, setShowScheduled, focus, ignored, setIgnored } =
    filters;
  return (
    <>
      <Input
        type="search"
        placeholder="Search by title or file name"
        aria-label="Search photos"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <Check
        checked={showScheduled}
        onChange={setShowScheduled}
        label="Show already scheduled photos"
      />
      {isFocused(focus) && (
        <Check
          checked={!ignored}
          onChange={(checked) => setIgnored(!checked)}
          label={
            <span>
              Focus: <span className="text-muted-foreground">{focusSummary(focus)}</span>
            </span>
          }
        />
      )}
    </>
  );
}

interface PickerListsProps {
  picker: PickerPhotos;
  unsaved: Unsaved;
  /** The photo on the day being picked for, if it has one. */
  current: SocialPhoto | undefined;
  /** What the day being picked for is called in the sections' descriptions. */
  dayName: string;
  onPick: (photo: SocialPhoto) => void;
}

/** **Before and after**, **Suggested** and **All photos**, each photo picked with onPick. */
export function PickerLists({ picker, unsaved, current, dayName, onPick }: PickerListsProps) {
  return (
    <>
      <NeighborChoices
        neighbors={picker.neighbors}
        unsaved={unsaved}
        current={current}
        dayName={dayName}
        onPick={onPick}
      />
      <SuggestedChoices suggestions={picker.suggestions} dayName={dayName} onPick={onPick} />
      <PickerChoices picker={picker} current={current} unsaved={unsaved} onPick={onPick} />
    </>
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
  dayName: string;
  onPick: (photo: SocialPhoto) => void;
}

/**
 * **Before and after**: the photos taken just before and after the last scheduled one, in the
 * order they were taken. Open at first; collapsed, it shows only its heading.
 */
function NeighborChoices({ neighbors, unsaved, current, dayName, onPick }: NeighborChoicesProps) {
  const grid = useGridClass();
  if (!neighbors || neighbors.photos.length === 0) return null;
  const { anchor, anchorDay } = neighbors;
  const description = `Taken just before and after ${photoName(anchor)}, the last photo scheduled before ${dayName} (${dayFormat.format(parseIsoDate(anchorDay))}).`;
  return (
    <PickerSection
      title="Before and after"
      description={description}
      count={neighbors.photos.length}
      defaultOpen
    >
      {(collapsed) =>
        !collapsed && (
          <ul className={grid}>
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
  dayName: string;
  onPick: (photo: SocialPhoto) => void;
}) {
  const { suggestions, dayName, onPick } = props;
  const grid = useGridClass();
  const peek = usePeek();
  if (suggestions.length === 0) return null;
  return (
    <PickerSection
      title="Suggested"
      icon={<SparklesIcon className="size-4" />}
      description={`Unused photos most like the 3 before ${dayName}: taken nearby, around the same time, or sharing tags.`}
      count={suggestions.length}
      defaultOpen={false}
    >
      {(collapsed) => (
        <ul className={grid}>
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.photo.path} className={peek(collapsed, index)}>
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

/** What an empty list of choices says when the Focus is filtering it, or else noChoices. */
function emptyMessage({ focused, searching, hidingScheduled }: PickerPhotos): string {
  if (focused) return "No photos match the Focus. Untick it to see every photo for now.";
  return noChoices(searching, hidingScheduled);
}

/** What an empty list of choices says. */
function noChoices(searching: boolean, hidingScheduled: boolean): string {
  if (searching) return hidingScheduled ? "No unscheduled photos match." : "No photos match.";
  return hidingScheduled ? "Every photo is already scheduled." : "There are no photo files yet.";
}

interface PickerChoicesProps {
  picker: PickerPhotos;
  current: SocialPhoto | undefined;
  unsaved: Unsaved;
  onPick: (photo: SocialPhoto) => void;
}

/** **All photos**: the rest of the photos the filters allow, headed when suggestions are above. */
function PickerChoices({ picker, current, unsaved, onPick }: PickerChoicesProps) {
  const grid = useGridClass();
  if (picker.choices.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">{emptyMessage(picker)}</p>;
  }
  return (
    <section className="flex flex-col gap-2" aria-label="All photos">
      {picker.titled && <h3 className="text-sm font-medium">All photos</h3>}
      <ul className={grid}>
        {picker.choices.map((photo) => (
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

/** In the drawer, the props that let a photo be dragged onto a calendar day. */
function useDragProps(photo: SocialPhoto) {
  const inDrawer = useContext(InDrawer);
  if (!inDrawer) return {};
  return {
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.setData(PHOTO_DRAG_TYPE, photo.path);
      event.dataTransfer.setData(DRAWER_DRAG_TYPE, "");
      event.dataTransfer.effectAllowed = "move";
    },
  };
}

/** The day a photo is on, in its corner: "This day" for the day being picked for. */
function ScheduledBadge({
  scheduled,
  isCurrent,
}: {
  scheduled: string | null;
  isCurrent: boolean;
}) {
  if (!scheduled) return null;
  return (
    <span className={cn(BADGE, "bg-primary text-primary-foreground absolute right-1 bottom-1")}>
      {isCurrent ? "This day" : dayFormat.format(parseIsoDate(scheduled))}
    </span>
  );
}

function PickerChoice({ photo, scheduled, isCurrent, reason, onPick }: PickerChoiceProps) {
  const drag = useDragProps(photo);
  return (
    <button
      type="button"
      disabled={isCurrent}
      onClick={onPick}
      {...drag}
      className={cn(
        "group focus-visible:ring-ring flex w-full flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-2 disabled:opacity-50",
        "draggable" in drag && "cursor-grab active:cursor-grabbing",
      )}
    >
      <span className="relative aspect-square overflow-hidden rounded-md border">
        <PhotoImage photo={photo} />
        <PhotoBadges photo={photo} />
        <ScheduledBadge scheduled={scheduled} isCurrent={isCurrent} />
      </span>
      <span className="truncate text-xs group-hover:underline">{photoName(photo)}</span>
      {reason && <span className="text-muted-foreground text-[11px] leading-tight">{reason}</span>}
    </button>
  );
}
