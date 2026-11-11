import { X } from "lucide-react";
import type { TripPoint } from "@/api/trip-lines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Which of the day's spots with no photo, the start or the end, the map is waiting to have picked. */
export type EndKey = "start" | "end";

/** What the map is waiting for, as the hint over it says. */
const HINTS: Record<EndKey, string> = {
  start: "Click the map where the day starts, such as the hotel.",
  end: "Click the map where the day ends, such as the hotel.",
};

/**
 * Says over the map that the next click sets the day's start or end spot, picked from the photo
 * strip's Start or End, with a way to stop; nothing while neither is being picked.
 */
export function PickHint({ picking, onCancel }: { picking?: EndKey; onCancel: () => void }) {
  if (!picking) return null;
  return (
    <div className="bg-muted flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm">
      {HINTS[picking]}
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/** A spot with no photo's label, such as "Hotel", and removing the spot. */
export function SpotLabel({
  spot,
  onChange,
}: {
  spot: TripPoint;
  onChange: (spot?: TripPoint) => void;
}) {
  return (
    <div className="flex gap-1">
      <Input
        value={spot.label ?? ""}
        placeholder="Hotel"
        aria-label="The spot's label"
        className="h-8"
        onChange={(e) => onChange({ ...spot, label: e.target.value })}
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Remove the spot"
        onClick={() => onChange(undefined)}
      >
        <X />
      </Button>
    </div>
  );
}
