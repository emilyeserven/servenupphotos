import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import { X } from "lucide-react";
import type { Spot } from "@/api/transit";
import type { LegMode, TripLeg } from "@/api/trips";
import { LegEndField } from "@/components/trips/leg-end";
import { LegRoute } from "@/components/trips/leg-route";
import { Button } from "@/components/ui/button";
import type { TripDay } from "@/lib/trip-days";
import { dayPhotos, distanceKm, endPhoto, endPosition, endSpot, withLegEnd } from "@/lib/trip-legs";

/** The ways a leg can be travelled, as the menu lists them. */
const LEG_MODES: { mode: LegMode; label: string }[] = [
  { mode: "ferry", label: "Ferry" },
  { mode: "flight", label: "Flight" },
  { mode: "train", label: "Train" },
  { mode: "bus", label: "Bus" },
  { mode: "car", label: "Car" },
];

interface LegRowProps {
  leg: TripLeg;
  /** Its place in the Trip, from 1. */
  n: number;
  dates: string[];
  days: Map<string, TripDay>;
  onChange: (leg: TripLeg) => void;
  onRemove: () => void;
}

/** Both ends' spots, once each has one. */
function bothEnds(a: Spot | undefined, b: Spot | undefined): [Spot, Spot] | undefined {
  return a && b ? [a, b] : undefined;
}

/** One leg of a Trip: how it was travelled, where it left and where it arrived, and the line ridden. */
export function LegRow({ leg, n, dates, days, onChange, onRemove }: LegRowProps) {
  const fromPhoto = endPhoto(leg.from, days, true);
  const toPhoto = endPhoto(leg.to, days, false);
  const ends = bothEnds(endSpot(leg.from, fromPhoto), endSpot(leg.to, toPhoto));
  return (
    <li className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Leg {n}</span>
        <select
          value={leg.mode}
          aria-label={`Leg ${n}: how it was travelled`}
          onChange={(e) => onChange({ ...leg, mode: e.target.value as LegMode })}
          className={SELECT_CLASS}
        >
          {LEG_MODES.map(({ mode, label }) => (
            <option key={mode} value={mode}>
              {label}
            </option>
          ))}
        </select>
        <LegKm leg={leg} fromPhoto={fromPhoto} toPhoto={toPhoto} />
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label={`Remove leg ${n}`}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <LegEndField
          title="Leaves"
          mode={leg.mode}
          end={leg.from}
          dates={dates}
          photo={fromPhoto}
          photoWord="last photo"
          photos={dayPhotos(days, leg.from.day)}
          onChange={(from) => onChange(withLegEnd(leg, "from", from, days))}
        />
        <LegEndField
          title="Arrives"
          mode={leg.mode}
          end={leg.to}
          dates={dates.filter((d) => d >= leg.from.day)}
          photo={toPhoto}
          photoWord="first photo"
          photos={dayPhotos(days, leg.to.day)}
          onChange={(to) => onChange(withLegEnd(leg, "to", to, days))}
        />
      </div>
      <LegRoute leg={leg} ends={ends} onChange={onChange} />
    </li>
  );
}

interface LegKmProps {
  leg: TripLeg;
  fromPhoto: ReturnType<typeof endPhoto>;
  toPhoto: ReturnType<typeof endPhoto>;
}

/** How long the leg is in a straight line, once both its ends have a spot. */
function LegKm({ leg, fromPhoto, toPhoto }: LegKmProps) {
  const from = endPosition(leg.from, fromPhoto);
  const to = endPosition(leg.to, toPhoto);
  if (!from || !to) return null;
  return (
    <span className="text-muted-foreground text-sm">
      {Math.round(distanceKm(from, to)).toLocaleString()} km
    </span>
  );
}
