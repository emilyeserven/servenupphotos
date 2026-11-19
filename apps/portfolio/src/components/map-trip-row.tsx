import { format, parseISO } from "date-fns";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { dayKey, type MapTrip } from "@/lib/map-trips";
import { cn } from "@/lib/utils";

/**
 * One Trip in the map's Trip tab: its checkbox, name and dates, and an arrow that opens a
 * checkbox for each of its days with lines, so one day can be shown or hidden on its own. The
 * Trip's checkbox is half ticked while some of its days are hidden, and its days can't be changed
 * while the whole Trip is hidden.
 */
export function TripRow({
  trip,
  hidden,
  onToggle,
}: {
  trip: MapTrip;
  /** The hidden Trips' IDs and days' `dayKey`s. */
  hidden: string[];
  /** Shows or hides a Trip (by ID) or a day (by `dayKey`). */
  onToggle: (key: string, shown: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const tripShown = !hidden.includes(trip.id);
  const someDaysHidden = trip.days.some((day) => hidden.includes(dayKey(day)));
  return (
    <li>
      <div className="flex items-start gap-1 rounded-sm hover:bg-accent">
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 px-1 py-1 text-sm select-none">
          <Checkbox
            checked={tripShown}
            mixed={tripShown && someDaysHidden}
            onChange={(shown) => onToggle(trip.id, shown)}
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{trip.name}</span>
            <span className="text-xs text-muted-foreground">{tripDays(trip)}</span>
          </span>
        </label>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Days of ${trip.name}`}
          onClick={() => setOpen(!open)}
          className="rounded-sm p-1.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            aria-hidden
            className={cn("size-4 transition-transform", open && "rotate-90")}
          />
        </button>
      </div>
      {open && (
        <DayList days={trip.days} hidden={hidden} disabled={!tripShown} onToggle={onToggle} />
      )}
    </li>
  );
}

/** A checkbox for each of a Trip's days, such as "Mon, Sep 22". */
function DayList({
  days,
  hidden,
  disabled,
  onToggle,
}: {
  days: string[];
  hidden: string[];
  disabled: boolean;
  onToggle: (key: string, shown: boolean) => void;
}) {
  return (
    <ul className="ml-7 flex flex-col" aria-label="Days">
      {days.map((day) => (
        <li key={day}>
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm select-none hover:bg-accent",
              disabled && "cursor-default opacity-50 hover:bg-transparent",
            )}
          >
            <Checkbox
              checked={!disabled && !hidden.includes(dayKey(day))}
              disabled={disabled}
              onChange={(shown) => onToggle(dayKey(day), shown)}
            />
            {format(parseISO(day), "EEE, MMM d")}
          </label>
        </li>
      ))}
    </ul>
  );
}

/** A checkbox that can be half ticked, which plain React can't set without a ref. */
function Checkbox({
  checked,
  mixed = false,
  disabled = false,
  onChange,
}: {
  checked: boolean;
  mixed?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
    />
  );
}

/** A Trip's days with lines written out, such as "Sep 22 – Oct 1, 2026 · 6 days". */
function tripDays({ start, end, days }: MapTrip): string {
  const first = parseISO(start);
  const last = parseISO(end);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const range =
    start === end
      ? format(first, "MMM d, yyyy")
      : `${format(first, sameYear ? "MMM d" : "MMM d, yyyy")} – ${format(last, "MMM d, yyyy")}`;
  return `${range} · ${days.length} ${days.length === 1 ? "day" : "days"}`;
}
