import { ChevronDown } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Matcher, MonthCaptionProps } from "react-day-picker";
import { Calendar } from "@portfolio/components/ui/calendar";
import { cn } from "@portfolio/lib/utils";

/** What the calendar's month caption does when clicked: opens the months over the years. */
const OpenMonthsContext = createContext<() => void>(() => {});

/** The month a date is in, as its first day. */
function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * A calendar of one month picking a single day, between `first` and `last`. Clicking the month's
 * name swaps the days for every month over the years, to jump to one.
 */
export function MonthCalendar({
  selected,
  onSelect,
  first,
  last,
  disabled,
}: {
  selected: Date | undefined;
  onSelect: (day: Date | undefined) => void;
  first: Date;
  last: Date;
  /** The days that can't be picked, such as those after the range's end. */
  disabled?: Matcher;
}) {
  const [month, setMonth] = useState(() => monthStart(selected ?? last));
  const [picking, setPicking] = useState(false);
  if (picking) {
    return (
      <MonthsOverYears
        shown={month}
        first={first}
        last={last}
        onPick={(picked) => {
          setMonth(picked);
          setPicking(false);
        }}
      />
    );
  }
  return (
    <OpenMonthsContext.Provider value={() => setPicking(true)}>
      <Calendar
        mode="single"
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={onSelect}
        startMonth={first}
        endMonth={last}
        disabled={disabled}
        components={{ MonthCaption }}
        className="bg-transparent p-0"
      />
    </OpenMonthsContext.Provider>
  );
}

/** The calendar's month name as a button that opens the months over the years. */
function MonthCaption({ calendarMonth, className, style }: MonthCaptionProps) {
  const open = useContext(OpenMonthsContext);
  return (
    <div className={className} style={style}>
      <button
        type="button"
        onClick={open}
        className="relative z-10 flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {calendarMonth.date.toLocaleString("en-US", { month: "long", year: "numeric" })}
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="sr-only">: pick another month</span>
      </button>
    </div>
  );
}

/** The years from `last` back to `first`, newest first. */
function yearsBetween(first: Date, last: Date): number[] {
  const count = last.getFullYear() - first.getFullYear() + 1;
  return Array.from({ length: count }, (_, index) => last.getFullYear() - index);
}

/** The months of a year, January first. */
const MONTH_NUMBERS = Array.from({ length: 12 }, (_, number) => number);

/**
 * Every month from `first` to `last`, a row of twelve for each year, newest first, opening on the
 * shown month's year; months without photos around them can't be picked.
 */
function MonthsOverYears({
  shown,
  first,
  last,
  onPick,
}: {
  shown: Date;
  first: Date;
  last: Date;
  onPick: (month: Date) => void;
}) {
  const shownYear = useRef<HTMLDivElement>(null);
  useEffect(() => {
    shownYear.current?.scrollIntoView({ block: "center" });
  }, []);
  const range = { from: monthStart(first), to: monthStart(last) };
  return (
    <div className="flex max-h-72 w-[16.5rem] flex-col gap-3 overflow-y-auto">
      {yearsBetween(first, last).map((year) => (
        <div
          key={year}
          ref={year === shown.getFullYear() ? shownYear : undefined}
          className="flex flex-col gap-1"
        >
          <span className="text-xs font-medium text-muted-foreground">{year}</span>
          <div className="grid grid-cols-6 gap-1">
            {MONTH_NUMBERS.map((number) => (
              <MonthButton
                key={number}
                month={new Date(year, number, 1)}
                shown={shown}
                range={range}
                onPick={onPick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One month to jump to, raised when it's the one shown. */
function MonthButton({
  month,
  shown,
  range,
  onPick,
}: {
  month: Date;
  shown: Date;
  range: { from: Date; to: Date };
  onPick: (month: Date) => void;
}) {
  const on = month.getTime() === shown.getTime();
  return (
    <button
      type="button"
      disabled={month < range.from || month > range.to}
      onClick={() => onPick(month)}
      aria-pressed={on}
      className={cn(
        "rounded-md py-1.5 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
        on && "bg-primary text-primary-foreground hover:bg-primary/90",
      )}
    >
      {month.toLocaleString("en-US", { month: "short" })}
    </button>
  );
}
