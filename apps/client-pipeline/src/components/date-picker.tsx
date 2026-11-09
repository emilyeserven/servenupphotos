import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { Matcher } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** The years the month and year menus offer: from 1970 to ten years from now. */
const FIRST_MONTH = new Date(1970, 0);
const LAST_MONTH = new Date(new Date().getFullYear() + 10, 11);

/**
 * Styles for the calendar's month and year menus, which our shadcn calendar doesn't style: each
 * menu is a see-through select over its label, so it reads like the rest of the calendar.
 */
const DROPDOWN_CLASS_NAMES = {
  dropdowns: "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
  dropdown_root:
    "relative rounded-md border border-input shadow-xs has-focus:border-ring has-focus:ring-[3px] has-focus:ring-ring/50",
  dropdown: "absolute inset-0 bg-popover opacity-0",
  caption_label:
    "flex h-8 items-center gap-1 rounded-md pr-1 pl-2 text-sm font-medium select-none [&>svg]:size-3.5 [&>svg]:rotate-90 [&>svg]:text-muted-foreground",
};

/** A YYYY-MM-DD day as a Date, or undefined for "". */
function toDate(value: string | undefined): Date | undefined {
  return value ? parseISO(value) : undefined;
}

/** The days outside `min` and `max`, which can't be picked. */
function outsideDays(min: string | undefined, max: string | undefined): Matcher[] {
  const before = toDate(min);
  const after = toDate(max);
  return [before && { before }, after && { after }].filter((matcher) => matcher !== undefined);
}

/** A day as the button shows it, such as "Tue, Nov 3, 2026", or the placeholder for "". */
function dayText(value: string, placeholder: string): string {
  return value ? format(parseISO(value), "EEE, MMM d, yyyy") : placeholder;
}

interface DatePickerProps {
  /** The button's id, so a label can point at it. */
  id?: string;
  /** The chosen day as YYYY-MM-DD, as a native date input's value is, or "" when none is. */
  value: string;
  /** Called with the picked day as YYYY-MM-DD, or "" when it's cleared. */
  onChange: (value: string) => void;
  /** The first day that can be picked, as YYYY-MM-DD. */
  min?: string;
  /** The last day that can be picked, as YYYY-MM-DD. */
  max?: string;
  disabled?: boolean;
  /** Classes for the button, such as its width. */
  className?: string;
  /** What the button says when no day is chosen. */
  placeholder?: string;
  /** The button's name for screen readers, when no label wraps or points at it. */
  "aria-label"?: string;
}

/**
 * A day, picked on the shadcn calendar in a popover, which the app uses in place of the browser's
 * date input. Its value is the same YYYY-MM-DD text, and a Clear button empties it.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a day",
  className,
  ...button
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-empty={!value}
          className={cn(
            "data-[empty=true]:text-muted-foreground justify-start font-normal",
            className,
          )}
          {...button}
        >
          <CalendarIcon />
          {dayText(value, placeholder)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={FIRST_MONTH}
          endMonth={LAST_MONTH}
          classNames={DROPDOWN_CLASS_NAMES}
          selected={toDate(value)}
          defaultMonth={toDate(value) ?? toDate(min)}
          disabled={outsideDays(min, max)}
          onSelect={(date) => pick(date ? format(date, "yyyy-MM-dd") : "")}
        />
        <div className="flex justify-end border-t px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!value}
            onClick={() => pick("")}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
