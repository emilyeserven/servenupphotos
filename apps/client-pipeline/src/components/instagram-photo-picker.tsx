import type { ReactNode } from "react";
import type { SocialPhoto } from "@/api/publish";
import { PickerFilters, PickerLists } from "@/components/instagram-picker/picker-lists";
import { usePickerPhotos } from "@/components/instagram-picker/use-picker-photos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { longDayFormat, parseIsoDate } from "@/lib/calendar";
import { type Unsaved, photoName } from "@/lib/social-schedule";

interface PhotoPickerProps {
  /** The day being picked for, or null when the picker is closed. */
  day: string | null;
  byDay: Map<string, SocialPhoto>;
  photos: SocialPhoto[];
  unsaved: Unsaved;
  onClose: () => void;
  /** Puts photo on day, or takes it off the calendar when day is null. */
  onSchedule: (photo: SocialPhoto, day: string | null) => void;
  /** More buttons for the day's photo, next to **Remove from this day**. */
  footer: (photo: SocialPhoto) => ReactNode;
  /** The footer of an empty day, such as **Mark as Not Stored**. */
  emptyFooter: (day: string) => ReactNode;
}

/** The photo on day, if the picker is open and the day has one. */
function dayPhoto(byDay: Map<string, SocialPhoto>, day: string | null): SocialPhoto | undefined {
  return day === null ? undefined : byDay.get(day);
}

/**
 * Picks a photo for a day, or takes the day's photo off it. **Before and after** comes first, with
 * the photos taken around the last scheduled one before the day, then **Suggested**, with photos
 * like the 3 before it. The calendar's photo drawer lists the same photos.
 */
export function PhotoPicker({
  day,
  byDay,
  photos,
  unsaved,
  onClose,
  onSchedule,
  footer,
  emptyFooter,
}: PhotoPickerProps) {
  const current = dayPhoto(byDay, day);
  const picker = usePickerPhotos(photos, unsaved, day);
  const close = () => {
    picker.reset();
    onClose();
  };
  const choose = (photo: SocialPhoto, to: string | null) => {
    picker.reset();
    onSchedule(photo, to);
  };

  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <PickerHeader day={day} current={current} />
        <PickerFilters filters={picker.filters} />
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          <PickerLists
            picker={picker}
            unsaved={unsaved}
            current={current}
            dayName="this day"
            onPick={(photo) => choose(photo, day)}
          />
        </div>
        <PickerFooter
          day={day}
          current={current}
          onRemove={(photo) => choose(photo, null)}
          footer={footer}
          emptyFooter={emptyFooter}
        />
      </DialogContent>
    </Dialog>
  );
}

interface PickerFooterProps extends Pick<PhotoPickerProps, "day" | "footer" | "emptyFooter"> {
  current: SocialPhoto | undefined;
  onRemove: (photo: SocialPhoto) => void;
}

/** The day's photo's buttons, or an empty day's own footer. */
function PickerFooter({ day, current, onRemove, footer, emptyFooter }: PickerFooterProps) {
  if (current) {
    return <RemoveFooter onRemove={() => onRemove(current)}>{footer(current)}</RemoveFooter>;
  }
  return day === null ? null : emptyFooter(day);
}

/** The button that takes the day's photo off the calendar, after any others for the photo. */
function RemoveFooter({ onRemove, children }: { onRemove: () => void; children?: ReactNode }) {
  return (
    <DialogFooter>
      {children}
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
