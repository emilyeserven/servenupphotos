import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { socialCalendarQuery } from "@/api/publish";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type UsedPostDays } from "@/lib/social-post-dates";
import { type PostedPhotoFile, postedPhotoFiles } from "@/lib/social-post-days";
import { useChangedPhotoFiles } from "@/stores/combined-data";

/**
 * Every photo file as the app has it now, gallery and in flight alike, with the changes waiting for
 * Commit and local edits made over them; empty until the photo files are read. The Photo page's
 * Spotlight card reads the same files, so this doesn't fetch anything more.
 */
export function usePostedPhotoFiles(): PostedPhotoFile[] {
  const read = useQuery(socialCalendarQuery).data?.photos;
  const changed = useChangedPhotoFiles();
  return useMemo(
    // Whether a photo is in ALLPHOTOS.json only sets `inFlight`, which the date picker doesn't use.
    () =>
      postedPhotoFiles(
        (read ?? []).map((photo) => ({ ...photo, inAllPhotos: true })),
        changed,
      ),
    [read, changed],
  );
}

interface SocialPostDatePickerProps {
  id: string;
  /** The chosen day as YYYY-MM-DD, or "" when none is. */
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  usedDays: UsedPostDays;
}

/** A day as the button shows it, such as "Tue, Nov 3, 2026". */
function dayText(value: string): string {
  return value ? format(parseISO(value), "EEE, MMM d, yyyy") : "Pick a day";
}

/** The chosen day as a Date for the calendar, or undefined when none is. */
function chosenDate(value: string): Date | undefined {
  return value ? parseISO(value) : undefined;
}

/**
 * A post's day, picked on a calendar. Days other photos already post on, on the same platform, are
 * grayed out but can still be picked, since two posts on one day is rare but fine.
 */
export function SocialPostDatePicker({
  id,
  value,
  disabled,
  onChange,
  usedDays,
}: SocialPostDatePickerProps) {
  const [open, setOpen] = useState(false);
  const used = useMemo(() => [...usedDays.keys()].map((day) => parseISO(day)), [usedDays]);
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            disabled={disabled}
            data-empty={!value}
            className="data-[empty=true]:text-muted-foreground h-9 w-full justify-start text-sm font-normal"
          >
            <CalendarIcon />
            {dayText(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={chosenDate(value)}
            defaultMonth={chosenDate(value)}
            onSelect={(date) => pick(date ? format(date, "yyyy-MM-dd") : "")}
            modifiers={{ used }}
            modifiersClassNames={{
              used: "text-muted-foreground opacity-50 data-[selected=true]:opacity-100",
            }}
          />
          <CalendarFooter hasValue={Boolean(value)} onClear={() => pick("")} />
        </PopoverContent>
      </Popover>
      <SharedDayNote names={usedDays.get(value)} />
    </div>
  );
}

/** What the grayed days mean, and a button to take the day off the post. */
function CalendarFooter({ hasValue, onClear }: { hasValue: boolean; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
      <p className="text-muted-foreground max-w-48 text-xs">
        Grayed days already have a post on this platform from another photo.
      </p>
      <Button variant="ghost" size="sm" disabled={!hasValue} onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

/** The other photos posting on the chosen day, when any are. */
function SharedDayNote({ names }: { names: string[] | undefined }) {
  if (!names) return null;
  return (
    <p className="text-muted-foreground text-xs">Also the day of a post for {names.join(", ")}.</p>
  );
}
