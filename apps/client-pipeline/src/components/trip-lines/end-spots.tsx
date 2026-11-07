import { Flag, MapPin, X } from "lucide-react";
import type { TripPoint } from "@/api/trip-lines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GapDraft } from "@/lib/trip-gaps";

/** Which of the day's spots with no photo the map is waiting to have picked. */
export type EndKey = "start" | "end";

interface EndSpotsProps {
  draft: GapDraft;
  onChange: (draft: GapDraft) => void;
  picking?: EndKey;
  onPicking: (key: EndKey | undefined) => void;
}

/** The spots with no photo the day starts from and ends at, such as the hotel: set on the map, with a label. */
export function EndSpots(props: EndSpotsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <EndSpot {...props} which="start" title="Starts from" icon={<MapPin className="size-4" />} />
      <EndSpot {...props} which="end" title="Ends at" icon={<Flag className="size-4" />} />
    </div>
  );
}

interface EndSpotProps extends EndSpotsProps {
  which: EndKey;
  title: string;
  icon: React.ReactNode;
}

function EndSpot({ draft, onChange, picking, onPicking, which, title, icon }: EndSpotProps) {
  const spot = draft[which];
  const set = (next: TripPoint | undefined) => onChange({ ...draft, [which]: next });
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {title}
      </span>
      {spot ? (
        <SpotLabel spot={spot} onChange={set} />
      ) : (
        <Button
          variant={picking === which ? "secondary" : "outline"}
          size="sm"
          className="self-start"
          onClick={() => onPicking(picking === which ? undefined : which)}
        >
          {picking === which ? "Click the map…" : "A spot with no photo"}
        </Button>
      )}
    </div>
  );
}

function SpotLabel({ spot, onChange }: { spot: TripPoint; onChange: (spot?: TripPoint) => void }) {
  return (
    <div className="flex gap-1">
      <Input
        value={spot.label ?? ""}
        placeholder="Hotel"
        aria-label="The spot's label"
        onChange={(e) => onChange({ ...spot, label: e.target.value })}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Remove the spot"
        onClick={() => onChange(undefined)}
      >
        <X />
      </Button>
    </div>
  );
}
