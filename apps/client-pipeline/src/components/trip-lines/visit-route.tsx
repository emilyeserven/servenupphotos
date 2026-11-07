import type { TripPhoto } from "@/lib/trip-days";

interface VisitRouteProps {
  photos: TripPhoto[];
  /** The ID of the photo the place comes after; none while it's off the route. */
  after?: number;
  onAfter: (after: number | undefined) => void;
}

/**
 * Where on the route a place visited goes: between two photos taken one after the other, so the
 * line passes through it, or off the route as a pin only.
 */
export function VisitRoute({ photos, after, onAfter }: VisitRouteProps) {
  const pairs = photos.slice(0, -1);
  return (
    <select
      aria-label="Where on the route"
      className="border-input bg-background h-8 rounded-md border px-2 text-sm"
      value={after ?? ""}
      onChange={(e) => onAfter(e.target.value === "" ? undefined : Number(e.target.value))}
    >
      <option value="">Not on the route</option>
      {pairs.map((p, i) => (
        <option key={p.id} value={p.id}>
          Between photos {i + 1} and {i + 2} ({p.time}–{photos[i + 1]!.time})
        </option>
      ))}
    </select>
  );
}
