import type { TransitLike, TripSegment } from "@/api/trip-lines";

/** What a transit hop can be drawn as, and what each does. */
const LIKES: { like: TransitLike | ""; label: string }[] = [
  { like: "", label: "Transit (straight, dashed)" },
  { like: "car", label: "Car (along roads, solid)" },
  { like: "bus", label: "Bus (along roads, dashed)" },
];

interface TransitLikePickerProps {
  hop: TripSegment;
  onLike: (like?: TransitLike) => void;
}

/**
 * For a transit hop of unknown kind, which mode it's routed and drawn like, such as a car along
 * roads no rail or bus map has. Snap to streets then routes it by road. Nothing for any other hop,
 * or while it rides a line found in a source, which follows that line's track.
 */
export function TransitLikePicker({ hop, onLike }: TransitLikePickerProps) {
  if (!borrowsMode(hop)) return null;
  return (
    <label className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">Draw it like</span>
      <select
        className="border-input bg-background h-8 rounded-md border px-2"
        value={hop.like ?? ""}
        onChange={(e) => onLike(likeOf(e.target.value))}
      >
        {LIKES.map((l) => (
          <option key={l.like} value={l.like}>
            {l.label}
          </option>
        ))}
      </select>
      <SnapHint hop={hop} />
    </label>
  );
}

/** Whether the hop can be drawn like another mode: a transit hop not riding a found line. */
function borrowsMode(hop: TripSegment): boolean {
  if (hop.mode !== "transit") return false;
  return !hop.line || hop.line.source === "named";
}

/** The mode picked in the menu, or none for "". */
function likeOf(value: string): TransitLike | undefined {
  return value === "car" || value === "bus" ? value : undefined;
}

/** Says to snap a hop drawn like a car or bus that isn't routed along the roads yet. */
function SnapHint({ hop }: { hop: TripSegment }) {
  if (!hop.like || hop.path) return null;
  return (
    <span className="text-muted-foreground">Snap to streets to route it along the roads.</span>
  );
}
