import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import type { TimelineLabel } from "@/api/timeline-labels";
import type { Trip } from "@/api/trips";

/** Starts a new Trip from a timeline label, copying its name and days, since a label like "Japan" usually is the trip. */
export function TripFromLabel({
  labels,
  onPick,
}: {
  labels: TimelineLabel[];
  onPick: (trip: Trip) => void;
}) {
  if (labels.length === 0) return null;
  return (
    <select
      value=""
      aria-label="New Trip from a timeline label"
      onChange={(e) => {
        const label = labels.find((l) => l.id === e.target.value);
        if (label)
          onPick({ id: "", name: label.name, start: label.start, end: label.end, legs: [] });
      }}
      className={SELECT_CLASS}
    >
      <option value="">From a timeline label…</option>
      {labels.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name} ({l.start})
        </option>
      ))}
    </select>
  );
}
