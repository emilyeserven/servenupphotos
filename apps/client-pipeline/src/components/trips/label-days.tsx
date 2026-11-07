import { format, parseISO } from "date-fns";
import { useState } from "react";
import type { TripLabel } from "@/api/trips";
import { dayTitle } from "@/components/trip-lines/day-title";

/** A label's first and last days. */
type Days = Pick<TripLabel, "start" | "end">;

interface LabelDaysProps {
  /** The label whose days are picked. */
  label: TripLabel;
  /** Every day of the Trip, first to last: the only days a label can cover. */
  dates: string[];
  /** The days other labels of the Trip already cover. */
  taken: Set<string>;
  onChange: (days: Days) => void;
}

/** The days between the two, the earlier one first. */
function between(a: string, b: string): Days {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

/**
 * The Trip's days as a row of buttons, the label's own picked: a click picks the first day and a
 * second click the last, like a date range picker that only shows the Trip.
 */
export function LabelDays({ label, dates, taken, onChange }: LabelDaysProps) {
  // The first day clicked, while waiting for the click on the last.
  const [first, setFirst] = useState<string>();
  const pick = (day: string) => {
    setFirst(first === undefined ? day : undefined);
    onChange(between(first ?? day, day));
  };
  return (
    <div className="flex flex-col gap-1">
      <ol className="flex flex-wrap gap-1" aria-label={`Days of ${label.name || "the label"}`}>
        {dates.map((day, i) => (
          <li key={day}>
            <DayButton
              day={day}
              withMonth={i === 0 || day.endsWith("-01")}
              on={day >= label.start && day <= label.end}
              taken={taken.has(day)}
              onClick={() => pick(day)}
            />
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground text-xs">
        {first ? `Now click its last day, or ${dayTitle(first)} again for just that day.` : ""}
      </p>
    </div>
  );
}

interface DayButtonProps {
  day: string;
  /** Whether to name the month too, as on the first day and each month's first. */
  withMonth: boolean;
  /** Whether the label covers the day. */
  on: boolean;
  /** Whether another label covers the day. */
  taken: boolean;
  onClick: () => void;
}

const DAY_BUTTON =
  "flex w-14 flex-col items-center rounded-md border px-1 py-1 text-xs leading-tight";

/** The day's colors: the label's own days filled, other labels' days struck out. */
function dayColors(on: boolean, taken: boolean): string {
  if (on) return "bg-primary text-primary-foreground border-primary";
  return taken ? "text-muted-foreground line-through" : "hover:bg-accent";
}

/** One of the Trip's days, such as "Tue" over "Sep 22". */
function DayButton({ day, withMonth, on, taken, onClick }: DayButtonProps) {
  const date = parseISO(day);
  return (
    <button
      type="button"
      aria-pressed={on}
      title={taken ? `${dayTitle(day)}: another label has it` : dayTitle(day)}
      onClick={onClick}
      className={`${DAY_BUTTON} ${dayColors(on, taken)}`}
    >
      <span>{format(date, "EEE")}</span>
      <span className="font-medium">{format(date, withMonth ? "MMM d" : "d")}</span>
    </button>
  );
}
