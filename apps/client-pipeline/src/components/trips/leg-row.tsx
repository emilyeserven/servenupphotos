import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import { X } from "lucide-react";
import type { LegMode, TripLeg } from "@/api/trips";
import { LegEndField } from "@/components/trips/leg-end";
import { Button } from "@/components/ui/button";
import type { TripDay } from "@/lib/trip-days";
import { distanceKm, endPhoto, endPosition } from "@/lib/trip-legs";

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

/** One leg of a Trip: how it was travelled, where it left and where it arrived. */
export function LegRow({ leg, n, dates, days, onChange, onRemove }: LegRowProps) {
  const fromPhoto = endPhoto(leg.from, days, true);
  const toPhoto = endPhoto(leg.to, days, false);
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
          end={leg.from}
          dates={dates}
          photo={fromPhoto}
          photoWord="last photo"
          onChange={(from) => onChange({ ...leg, from })}
        />
        <LegEndField
          title="Arrives"
          end={leg.to}
          dates={dates.filter((d) => d >= leg.from.day)}
          photo={toPhoto}
          photoWord="first photo"
          onChange={(to) => onChange({ ...leg, to })}
        />
      </div>
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
