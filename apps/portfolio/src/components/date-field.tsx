import { CalendarDays, X } from "lucide-react";
import { useState } from "react";
import type { Matcher } from "react-day-picker";
import { MonthCalendar } from "@portfolio/components/month-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";

/** A day as a field shows it, such as "Mar 1, 2024". */
function fieldText(day: Date): string {
  return day.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * One end of a date range, such as From: a field showing its day, or "Any day" when it's open,
 * that opens its own calendar, and an X that clears it.
 */
export function DateField({
  label,
  value,
  onChange,
  first,
  last,
  disabled,
}: {
  label: string;
  value: Date | undefined;
  onChange: (day: Date | undefined) => void;
  first: Date;
  last: Date;
  /** The days that can't be picked, such as those after the other end. */
  disabled?: Matcher;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center rounded-md border bg-background shadow-xs">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className={value ? "truncate" : "truncate text-muted-foreground"}>
              {value ? fieldText(value) : "Any day"}
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3">
            <MonthCalendar
              selected={value}
              onSelect={(day) => {
                onChange(day);
                setOpen(false);
              }}
              first={first}
              last={last}
              disabled={disabled}
            />
          </PopoverContent>
        </Popover>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="mr-1 rounded-sm p-1 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
