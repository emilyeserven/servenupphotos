import { Flag, MapPin } from "lucide-react";
import { useState } from "react";
import type { TripPoint } from "@/api/trip-lines";
import { SpotChoice, type StripEnds } from "@/components/trip-lines/strip-ends";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type BreakPick, breakEndOf, withBreakEnd } from "@/lib/break-ends";
import type { GapDraft } from "@/lib/trip-gaps";
import { cn } from "@/lib/utils";

interface BreakSpotsProps {
  draft: GapDraft;
  onChange: (draft: GapDraft) => void;
  /** The last photo before the break, and the first after it. */
  around: [number, number];
  /** Picking a spot on the map. */
  spots: Pick<StripEnds, "onPick" | "picking">;
}

/**
 * Where the line before a break ends and the line after it starts, such as back at the hotel for
 * lunch and out again from it: each group around the break gets its own end and start, set on the map.
 */
export function BreakSpots({ draft, onChange, around: [a, b], spots }: BreakSpotsProps) {
  return (
    <div className="flex gap-1">
      <BreakSpot pick={`break-end:${a}`} draft={draft} onChange={onChange} spots={spots} />
      <BreakSpot pick={`break-start:${b}`} draft={draft} onChange={onChange} spots={spots} />
    </div>
  );
}

/** What each side of a break is called, and its icon. */
const SIDES = {
  "break-end": { title: "End", hint: "Where the line before the break ends", icon: Flag },
  "break-start": { title: "Start", hint: "Where the line after the break starts", icon: MapPin },
} as const;

interface BreakSpotProps extends Omit<BreakSpotsProps, "around"> {
  pick: BreakPick;
}

/** One side of a break: a small chip naming its spot, or dashed while it has none, with its menu. */
function BreakSpot({ pick, draft, onChange, spots }: BreakSpotProps) {
  const [open, setOpen] = useState(false);
  const spot = breakEndOf(draft, pick);
  const side = sideOf(pick);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <BreakChip side={side} spot={spot} picking={spots.picking === pick} />
      </PopoverTrigger>
      <PopoverContent align="center" className="flex w-64 flex-col gap-1 p-2">
        <p className="px-1 text-xs font-medium">{side.hint}</p>
        <SpotChoice
          spot={spot}
          onSpot={(s) => onChange(withBreakEnd(draft, pick, s))}
          onPick={() => {
            spots.onPick(pick);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Which side of a break `pick` is: its name, hint and icon. */
function sideOf(pick: BreakPick) {
  return SIDES[pick.startsWith("break-end") ? "break-end" : "break-start"];
}

interface BreakChipProps extends React.ComponentProps<"button"> {
  side: ReturnType<typeof sideOf>;
  spot?: TripPoint;
  /** Whether the map is waiting to have this spot picked. */
  picking: boolean;
}

/** The chip itself, which opens the menu: the spot's label, or the side's name while it has none. */
function BreakChip({ side, spot, picking, className, ...props }: BreakChipProps) {
  const Icon = side.icon;
  return (
    <button
      type="button"
      title={side.hint}
      className={cn(
        "hover:bg-muted flex w-16 flex-col items-center gap-0.5 rounded-md border p-1 text-[11px]",
        spot ? "bg-muted/50" : "text-muted-foreground border-dashed",
        { "ring-ring ring-2": picking },
        className,
      )}
      {...props}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="line-clamp-1 break-all">{chipLabel(side.title, spot)}</span>
    </button>
  );
}

/** What the chip says: the spot's label, "Spot" for one with none, or the side's name while unset. */
function chipLabel(title: string, spot: TripPoint | undefined): string {
  if (!spot) return title;
  return spot.label || "Spot";
}
