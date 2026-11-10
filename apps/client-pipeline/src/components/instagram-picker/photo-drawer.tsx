import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react";
import { type DragEvent, type ReactNode, useState } from "react";
import type { NotStoredPost } from "@/api/not-stored";
import type { SocialPhoto } from "@/api/publish";
import {
  DRAWER_DRAG_TYPE,
  InDrawerProvider,
  PickerFilters,
  PickerLists,
} from "@/components/instagram-picker/picker-lists";
import { usePickerPhotos } from "@/components/instagram-picker/use-picker-photos";
import { Button } from "@/components/ui/button";
import { useDropTarget } from "@/hooks/use-drop-target";
import { longDayFormat, parseIsoDate } from "@/lib/calendar";
import { PHOTO_DRAG_TYPE, type Unsaved } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pipeline-instagram-photo-drawer";

/** Whether the photo drawer was left open, read from the browser; closed when it can't be read. */
function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "open";
  } catch {
    return false;
  }
}

/** Whether the calendar's photo drawer is open, kept in the browser so a reload leaves it so. */
export function usePhotoDrawer() {
  const [open, setOpen] = useState(readOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
    } catch {
      // Not kept for next time, which is fine.
    }
  };
  return { open, toggle };
}

/**
 * The Calendar tab's layout: its content, with the photo drawer to its right on a wide screen and
 * under it on a narrow one, when drawer is open.
 */
export function DrawerLayout({ drawer, children }: { drawer: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
      {drawer}
    </div>
  );
}

/** The button by the week buttons that opens and closes the photo drawer. */
export function PhotoDrawerToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Button variant={open ? "secondary" : "outline"} aria-pressed={open} onClick={onToggle}>
      {open ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
      Photos
    </Button>
  );
}

interface PhotoDrawerProps {
  photos: SocialPhoto[];
  unsaved: Unsaved;
  byDay: Map<string, SocialPhoto>;
  /** Each day's Not Stored post, by day; those days take no photo. */
  notStored: Map<string, NotStoredPost>;
  /** The days the calendar shows. */
  days: string[];
  today: string;
  /** Puts photo on day, or takes it off the calendar when day is null. */
  onSchedule: (photo: SocialPhoto, day: string | null) => void;
  onClose: () => void;
}

/** The days shown from today on with no photo and no Not Stored post. */
function openDays({ days, today, byDay, notStored }: PhotoDrawerProps): string[] {
  return days.filter((day) => day >= today && !byDay.has(day) && !notStored.has(day));
}

/**
 * The day the drawer suggests photos for and clicking a photo puts it on: the one picked, while
 * it's still open, or else the first open day.
 */
function useTargetDay(open: string[]) {
  const [picked, setPicked] = useState<string | null>(null);
  const target = picked !== null && open.includes(picked) ? picked : (open[0] ?? null);
  return { target, setPicked };
}

/**
 * Drag handlers that take a calendar photo dropped on the drawer off the calendar. A photo dragged
 * from the drawer itself can't be dropped back on it.
 */
function useUnscheduleDrop(photos: SocialPhoto[], onSchedule: PhotoDrawerProps["onSchedule"]) {
  const { over, handlers } = useDropTarget(PHOTO_DRAG_TYPE, (path) => {
    const photo = photos.find((p) => p.path === path);
    if (photo) onSchedule(photo, null);
  });
  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(DRAWER_DRAG_TYPE)) handlers.onDragOver(event);
  };
  return { over, handlers: { ...handlers, onDragOver } };
}

/**
 * A panel beside the calendar listing the photos its day picker does, with the same search,
 * boxes, Focus, **Before and after** and **Suggested**. A photo is dragged from it onto a day, or
 * clicked to go on the day it suggests for; a calendar photo dropped on it comes off the calendar.
 */
export function PhotoDrawer(props: PhotoDrawerProps) {
  const { photos, unsaved, onSchedule, onClose } = props;
  const open = openDays(props);
  const { target, setPicked } = useTargetDay(open);
  const picker = usePickerPhotos(photos, unsaved, target);
  const { over, handlers } = useUnscheduleDrop(photos, onSchedule);
  return (
    <aside
      aria-label="Photo drawer"
      className={cn(
        "bg-card flex max-h-[calc(100vh-6rem)] flex-col gap-3 rounded-xl border p-4 shadow-sm lg:sticky lg:top-4 lg:w-80 lg:shrink-0 xl:w-96",
        over && "ring-ring ring-2",
      )}
      {...handlers}
    >
      <DrawerHeader onClose={onClose} />
      <TargetDayPicker open={open} target={target} onPick={setPicked} />
      <PickerFilters filters={picker.filters} />
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
        <InDrawerProvider value>
          <PickerLists
            picker={picker}
            unsaved={unsaved}
            current={undefined}
            dayName="that day"
            onPick={(photo) => target !== null && onSchedule(photo, target)}
          />
        </InDrawerProvider>
      </div>
    </aside>
  );
}

function DrawerHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">Photos</h2>
        <p className="text-muted-foreground text-xs">
          Drag a photo onto a day, or click it to put it on the day below. Drop a calendar photo
          here to take it off the calendar.
        </p>
      </div>
      <Button variant="ghost" size="icon" aria-label="Close photo drawer" onClick={onClose}>
        <PanelRightCloseIcon />
      </Button>
    </div>
  );
}

interface TargetDayPickerProps {
  open: string[];
  target: string | null;
  onPick: (day: string) => void;
}

/** The open day the drawer suggests photos for, which can be changed to another open day. */
function TargetDayPicker({ open, target, onPick }: TargetDayPickerProps) {
  if (target === null) {
    return (
      <p className="text-muted-foreground text-sm">
        Every day shown from today on is taken, so there&apos;s nothing to suggest for. Drag a photo
        onto a day to swap it in.
      </p>
    );
  }
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Suggest for</span>
      <select
        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        value={target}
        onChange={(event) => onPick(event.target.value)}
      >
        {open.map((day) => (
          <option key={day} value={day}>
            {longDayFormat.format(parseIsoDate(day))}
          </option>
        ))}
      </select>
    </label>
  );
}
