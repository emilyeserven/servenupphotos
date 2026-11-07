import type { Trip, TripLabel } from "@/api/trips";

/** Whether two runs of days share a day. */
function overlaps(a: TripLabel, b: TripLabel): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Whether the label's days are within the Trip's, the first one first. */
function withinTrip(trip: Trip, label: TripLabel): boolean {
  return label.start >= trip.start && label.end <= trip.end && label.start <= label.end;
}

/** What's wrong with one label of the Trip, such as days outside it; "" when nothing is. */
function labelProblem(trip: Trip, label: TripLabel): string {
  if (!label.name.trim()) return "Give each timeline label a name.";
  if (withinTrip(trip, label)) return "";
  return `Pick the days of “${label.name.trim()}” within the Trip, the first one first.`;
}

/** Two of the labels that share a day, as a sentence; "" when none do. */
function overlapProblem(labels: TripLabel[]): string {
  const [a, b] = labels.flatMap((x, i) =>
    labels.slice(i + 1).flatMap((y) => (overlaps(x, y) ? [x, y] : [])),
  );
  return a && b ? `“${a.name}” and “${b.name}” share some days. Give each day one label.` : "";
}

/** Why the Trip's timeline labels can't be saved, as the backend checks them; "" when they can. */
export function labelsProblem(trip: Trip): string {
  const own = trip.labels.map((label) => labelProblem(trip, label)).find(Boolean);
  return own ?? overlapProblem(trip.labels);
}

/** A new label after the others: from the day after the last one ends, or the Trip's first day, to its last. */
export function nextLabel(trip: Trip, dates: string[]): TripLabel {
  const after = trip.labels
    .map((l) => l.end)
    .toSorted()
    .at(-1);
  const start = dates.find((d) => after === undefined || d > after) ?? trip.start;
  return { name: "", start, end: trip.end };
}
