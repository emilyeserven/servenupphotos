import { Plus, X } from "lucide-react";
import type { Trip, TripLabel } from "@/api/trips";
import { dayRange } from "@/components/trips/day-range";
import { LabelDays } from "@/components/trips/label-days";
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
        <ol className="flex flex-col gap-3">
          {trip.labels.map((label, i) => (
            <LabelRow
              // Labels have no ID of their own; their place in the Trip is what they are.
              // oxlint-disable-next-line react/no-array-index-key
              key={i}
              label={label}
              dates={dates}
              taken={takenBy(trip.labels, i, dates)}
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
  /** The days the Trip's other labels cover. */
  taken: Set<string>;
  onChange: (label: TripLabel) => void;
  onRemove: () => void;
}

/** One label: its name, and its days, clicked among the Trip's. */
function LabelRow({ label, dates, taken, onChange, onRemove }: LabelRowProps) {
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={label.name}
          placeholder="Japan"
          aria-label="Label name"
          className="max-w-xs"
          onChange={(e) => onChange({ ...label, name: e.target.value })}
        />
        <span className="text-muted-foreground flex-1 text-sm">
          {dayRange(label.start, label.end)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${label.name || "label"}`}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
      <LabelDays
        label={label}
        dates={dates}
        taken={taken}
        onChange={(days) => onChange({ ...label, ...days })}
      />
    </li>
  );
}

/** The days the labels other than the one at i cover. */
function takenBy(labels: TripLabel[], i: number, dates: string[]): Set<string> {
  const others = labels.filter((_, j) => j !== i);
  return new Set(dates.filter((d) => others.some((l) => d >= l.start && d <= l.end)));
}
