import type { TripVisit } from "@/api/trip-lines";
import { GAPS, gapInfo } from "@/components/trip-lines/modes";

/** The ways a trip stop can be reached: any a gap can be travelled, but a break or a wander. */
const WAYS = GAPS.filter((g) => g.gap !== "break" && g.gap !== "wander").map((g) => ({
  ...g,
  label: g.gap === "walk" ? "Walked" : g.label,
}));

interface StopWaySelectProps {
  visit: TripVisit;
  onChange: (visit: TripVisit) => void;
}

/**
 * How a trip stop on the route was reached from the point before it, such as walked between two
 * stations in the middle of a train ride; the route's own way there by default. Nothing for a stop
 * off the route.
 */
export function StopWaySelect({ visit, onChange }: StopWaySelectProps) {
  if (visit.after === undefined && !visit.first) return null;
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">Got here by</span>
      <select
        className="border-input bg-background h-8 rounded-md border px-2"
        value={visit.mode ?? ""}
        onChange={(e) => onChange(withWay(visit, e.target.value))}
      >
        <option value="">The route's way</option>
        {WAYS.map((w) => (
          <option key={w.gap} value={w.gap}>
            {w.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The visit reached by way, or the route's own way for "". */
function withWay({ mode: _was, ...visit }: TripVisit, way: string): TripVisit {
  return way ? { ...visit, mode: way as TripVisit["mode"] } : visit;
}

/** A small icon before a trip stop in the photo strip for how it was reached; none for the route's way. */
export function StopWayIcon({ visit }: { visit: TripVisit }) {
  if (!visit.mode) return null;
  const { icon: Icon, label } = gapInfo(visit.mode);
  return (
    <span className="text-amber-700 dark:text-amber-300" title={`Got here by: ${label}`}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">Got here by: {label}</span>
    </span>
  );
}
