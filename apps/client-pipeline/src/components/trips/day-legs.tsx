import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { TripLeg } from "@/api/trips";
import { dayTitle } from "@/components/trip-lines/day-title";
import { LegRow } from "@/components/trips/leg-row";
import { Button } from "@/components/ui/button";
import type { TripDay } from "@/lib/trip-days";

/** How a leg's mode reads in a sentence, such as "Flight". */
const MODE_WORDS: Record<TripLeg["mode"], string> = {
  ferry: "Ferry",
  flight: "Flight",
  train: "Train",
  bus: "Bus",
  car: "Car",
};

interface DayLegsProps {
  /** Every day of the Trip, first to last. */
  dates: string[];
  legs: TripLeg[];
  /** The days with photos at an exact spot, by day. */
  days: Map<string, TripDay>;
  onChange: (legs: TripLeg[]) => void;
}

/**
 * The Trip's days, first to last, each with the legs that leave it, edited where they are, and a
 * button to add one. A day can have any number of legs, each from one of its photos or a spot.
 */
export function DayLegs({ dates, legs, days, onChange }: DayLegsProps) {
  const setLeg = (i: number, leg?: TripLeg) =>
    onChange(legs.flatMap((l, j) => (j !== i ? [l] : leg ? [leg] : [])));
  const addLeg = (day: string) => onChange([...legs, newLeg(day, dates)]);
  const stray = legs.flatMap((leg, i) => (dates.includes(leg.from.day) ? [] : [i]));
  const rows = { legs, dates, days, setLeg };
  return (
    <ol className="flex flex-col divide-y rounded-md border">
      {dates.map((day) => (
        <DayRow key={day} day={day} {...rows} onAdd={() => addLeg(day)} />
      ))}
      {stray.length > 0 && <StrayLegs indexes={stray} {...rows} />}
    </ol>
  );
}

/** A new ferry from the day to the next one, or to the same day on the Trip's last. */
function newLeg(day: string, dates: string[]): TripLeg {
  const to = dates.find((d) => d > day) ?? day;
  return { mode: "ferry", from: { day }, to: { day: to } };
}

interface RowsProps {
  legs: TripLeg[];
  dates: string[];
  days: Map<string, TripDay>;
  setLeg: (i: number, leg?: TripLeg) => void;
}

/** The legs at the indexes, each edited in place. */
function Legs({ indexes, legs, dates, days, setLeg }: RowsProps & { indexes: number[] }) {
  if (indexes.length === 0) return null;
  return (
    <ol className="flex flex-col gap-3">
      {indexes.map((i) => (
        <LegRow
          // Legs have no ID of their own; their place in the Trip is what they are.
          // oxlint-disable-next-line react/no-array-index-key
          key={i}
          leg={legs[i]!}
          n={i + 1}
          dates={dates}
          days={days}
          onChange={(next) => setLeg(i, next)}
          onRemove={() => setLeg(i)}
        />
      ))}
    </ol>
  );
}

/** The indexes of the legs whose end on the side is the day. */
function legsOn(legs: TripLeg[], day: string, side: "from" | "to"): number[] {
  return legs.flatMap((leg, i) => (leg[side].day === day ? [i] : []));
}

function DayRow({ day, onAdd, ...rows }: RowsProps & { day: string; onAdd: () => void }) {
  const leaving = legsOn(rows.legs, day, "from");
  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <DayName day={day} trip={rows.days.get(day)} />
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus />
          Add a leg from this day
        </Button>
      </div>
      <Arrivals legs={rows.legs} indexes={legsOn(rows.legs, day, "to")} />
      <Legs indexes={leaving} {...rows} />
    </li>
  );
}

/** The day's date, linking to its Route page when it has photos at an exact spot, and how many. */
function DayName({ day, trip }: { day: string; trip: TripDay | undefined }) {
  if (!trip) {
    return (
      <span className="text-sm font-medium">
        {dayTitle(day)}{" "}
        <span className="text-muted-foreground font-normal">· no route to mark</span>
      </span>
    );
  }
  return (
    <Link
      to="/trip-lines/$day/$part"
      params={{ day, part: "route" }}
      className="text-sm font-medium underline-offset-4 hover:underline"
    >
      {dayTitle(day)}{" "}
      <span className="text-muted-foreground font-normal">· {trip.photos.length} photos</span>
    </Link>
  );
}

/** The legs that arrive on the day, such as "Arrives by Flight (leg 1, from Tue, Sep 22)". */
function Arrivals({ legs, indexes }: { legs: TripLeg[]; indexes: number[] }) {
  if (indexes.length === 0) return null;
  return (
    <ul className="text-muted-foreground flex flex-col text-xs">
      {indexes.map((i) => (
        <li key={i}>
          Arrives by {MODE_WORDS[legs[i]!.mode]} (leg {i + 1}, from {dayTitle(legs[i]!.from.day)})
        </li>
      ))}
    </ul>
  );
}

/** Legs that leave on a day outside the Trip, after its days changed, to fix or remove. */
function StrayLegs(props: RowsProps & { indexes: number[] }) {
  return (
    <li className="flex flex-col gap-2 p-3">
      <span className="text-destructive text-sm font-medium">Leaving outside the Trip's days</span>
      <Legs {...props} />
    </li>
  );
}
