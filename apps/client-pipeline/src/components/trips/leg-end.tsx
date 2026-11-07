import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import { useState } from "react";
import type { TripLegEnd } from "@/api/trips";
import { dayTitle } from "@/components/trip-lines/day-title";
import { Input } from "@/components/ui/input";
import { parsePosition } from "@/lib/trip-legs";
import type { TripPhoto } from "@/lib/trip-days";

interface LegEndFieldProps {
  /** What the end is, such as "Leaves". */
  title: string;
  end: TripLegEnd;
  /** The Trip's days, which the end can be on. */
  dates: string[];
  /** The photo it uses without a spot of its own, and what it's called there, such as "last photo". */
  photo: TripPhoto | undefined;
  photoWord: string;
  onChange: (end: TripLegEnd) => void;
}

/** One end of a leg: its day, and either that day's photo or a spot with no photo, such as an airport. */
export function LegEndField({ title, end, dates, photo, photoWord, onChange }: LegEndFieldProps) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      <select
        value={end.day}
        aria-label={`${title}: day`}
        onChange={(e) => onChange({ ...end, day: e.target.value })}
        className={SELECT_CLASS}
      >
        {dates.map((d) => (
          <option key={d} value={d}>
            {dayTitle(d)}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={end.spot !== undefined}
          onChange={(e) =>
            onChange({
              day: end.day,
              spot: e.target.checked ? startingSpot(photo) : undefined,
            })
          }
        />
        A spot with no photo
      </label>
      {end.spot ? (
        <SpotFields end={end} title={title} onChange={onChange} />
      ) : (
        <PhotoNote photo={photo} photoWord={photoWord} />
      )}
    </fieldset>
  );
}

/** A new spot, where the day's photo is, to move from there; or at 0, 0 without one. */
function startingSpot(photo: TripPhoto | undefined) {
  return photo
    ? { latitude: photo.latitude, longitude: photo.longitude }
    : { latitude: 0, longitude: 0 };
}

function PhotoNote({ photo, photoWord }: { photo: TripPhoto | undefined; photoWord: string }) {
  if (!photo)
    return <p className="text-destructive text-xs">No photo with an exact spot on this day.</p>;
  const title = typeof photo.photo.title === "string" ? photo.photo.title : `Photo ${photo.id}`;
  return (
    <p className="text-muted-foreground text-xs">
      The day's {photoWord}: {title} ({photo.time})
    </p>
  );
}

interface SpotFieldsProps {
  end: TripLegEnd;
  title: string;
  onChange: (end: TripLegEnd) => void;
}

/** A spot's label and where it is, typed as "latitude, longitude". */
function SpotFields({ end, title, onChange }: SpotFieldsProps) {
  const spot = end.spot!;
  const [text, setText] = useState(() => `${spot.latitude}, ${spot.longitude}`);
  const valid = parsePosition(text) !== undefined;
  return (
    <div className="flex flex-col gap-1">
      <Input
        value={spot.label ?? ""}
        placeholder="Hakata Port"
        aria-label={`${title}: the spot's label`}
        onChange={(e) => onChange({ ...end, spot: { ...spot, label: e.target.value } })}
      />
      <Input
        value={text}
        placeholder="33.6064, 130.4017"
        aria-label={`${title}: latitude, longitude`}
        aria-invalid={!valid}
        onChange={(e) => {
          setText(e.target.value);
          const at = parsePosition(e.target.value);
          if (at) onChange({ ...end, spot: { ...spot, ...at } });
        }}
      />
      <p className="text-muted-foreground text-xs">
        {valid
          ? "Latitude, longitude, such as from Google Maps."
          : "Type it as latitude, longitude."}
      </p>
    </div>
  );
}
