import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import { Plus, X } from "lucide-react";
import type { Trip, TripLabel } from "@/api/trips";
import { dayTitle } from "@/components/trip-lines/day-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nextLabel } from "@/lib/trip-labels";

interface TripLabelsProps {
  /** The Trip as it will be saved, whose days the labels can cover. */
  trip: Trip;
  /** Every day of the Trip, first to last. */
  dates: string[];
  onChange: (labels: TripLabel[]) => void;
}

/**
 * The Trip's timeline labels: names the Timeline shows in place of the Trip's on the days picked for
 * each, such as "Korea" and "Japan" in a "Korea and Japan" Trip.
 */
export function TripLabels({ trip, dates, onChange }: TripLabelsProps) {
  const set = (i: number, label?: TripLabel) =>
    onChange(trip.labels.flatMap((l, j) => (j !== i ? [l] : label ? [label] : [])));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">Timeline labels</h3>
        <p className="text-muted-foreground text-sm">
          Optional: names the Timeline shows in place of “{trip.name || "the Trip's name"}” on the
          days you pick, such as Korea and then Japan. A day no label covers shows the Trip's name.
        </p>
      </div>
      {trip.labels.length > 0 && (
        <ol className="flex flex-col gap-2">
          {trip.labels.map((label, i) => (
            <LabelRow
              // Labels have no ID of their own; their place in the Trip is what they are.
              // oxlint-disable-next-line react/no-array-index-key
              key={i}
              label={label}
              dates={dates}
              onChange={(next) => set(i, next)}
              onRemove={() => set(i)}
            />
          ))}
        </ol>
      )}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={dates.length === 0}
        onClick={() => onChange([...trip.labels, nextLabel(trip, dates)])}
      >
        <Plus />
        Add a timeline label
      </Button>
    </div>
  );
}

interface LabelRowProps {
  label: TripLabel;
  dates: string[];
  onChange: (label: TripLabel) => void;
  onRemove: () => void;
}

/** One label: its name, and its first and last days, picked from the Trip's. */
function LabelRow({ label, dates, onChange, onRemove }: LabelRowProps) {
  return (
    <li className="grid items-center gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <Input
        value={label.name}
        placeholder="Japan"
        aria-label="Label name"
        onChange={(e) => onChange({ ...label, name: e.target.value })}
      />
      <DaySelect
        value={label.start}
        dates={dates}
        title="First day"
        onChange={(start) => onChange({ ...label, start })}
      />
      <DaySelect
        value={label.end}
        dates={dates.filter((d) => d >= label.start)}
        title="Last day"
        onChange={(end) => onChange({ ...label, end })}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${label.name || "label"}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </li>
  );
}

interface DaySelectProps {
  value: string;
  dates: string[];
  title: string;
  onChange: (day: string) => void;
}

function DaySelect({ value, dates, title, onChange }: DaySelectProps) {
  return (
    <select
      value={value}
      aria-label={title}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      {dates.map((d) => (
        <option key={d} value={d}>
          {dayTitle(d)}
        </option>
      ))}
    </select>
  );
}
