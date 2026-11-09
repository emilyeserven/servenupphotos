import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import { useState } from "react";
import type { TripLegEnd } from "@/api/trips";
import { dayTitle } from "@/components/trip-lines/day-title";
import { LegStation } from "@/components/trips/leg-station";
import { PointFields } from "@/components/trips/point-fields";
import { StationSearch } from "@/components/trips/station-search";
import { endSpot, ridesLegLine } from "@/lib/trip-legs";
import type { TripPhoto } from "@/lib/trip-days";

interface LegEndFieldProps {
  /** What the end is, such as "Leaves". */
  title: string;
  /** How the leg was travelled, which picks whether its ends can be stations. */
  mode: string;
  end: TripLegEnd;
  /** The Trip's days, which the end can be on. */
  dates: string[];
  /** The photo it uses without a spot of its own, and what it's called there, such as "last photo". */
  photo: TripPhoto | undefined;
  photoWord: string;
  /** The day's photos with an exact spot, in the order taken, which it can leave from or arrive at. */
  photos: TripPhoto[];
  onChange: (end: TripLegEnd) => void;
}

/** One end of a leg: its day, and either one of that day's photos or a spot with no photo, such as an airport. */
export function LegEndField(props: LegEndFieldProps) {
  const { title, end, dates, photo, onChange } = props;
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      <select
        value={end.day}
        aria-label={`${title}: day`}
        onChange={(e) => onChange({ day: e.target.value, spot: end.spot })}
        className={SELECT_CLASS}
      >
        {dates.map((d) => (
          <option key={d} value={d}>
            {dayTitle(d)}
          </option>
        ))}
      </select>
      <WherePicker {...props} />
      {end.spot ? (
        <StationOrSpot {...props} />
      ) : (
        <PhotoNote photo={photo} photoWord={props.photoWord} named={end.photo !== undefined} />
      )}
      <LegStation title={title} mode={props.mode} end={end} photo={photo} onChange={onChange} />
    </fieldset>
  );
}

/** What the "where" menu shows for the end: a photo's ID, the day's usual photo, or a spot. */
function whereValue(end: TripLegEnd): string {
  if (end.spot) return SPOT;
  return end.photo === undefined ? DAY_PHOTO : String(end.photo);
}

/** The "where" menu's choice for a spot with no photo, and for the day's last or first photo. */
const SPOT = "spot";
const DAY_PHOTO = "day";

/** The end with the "where" menu's choice: a spot, one of the day's photos, or its usual photo. */
function withWhere(end: TripLegEnd, where: string, photo: TripPhoto | undefined): TripLegEnd {
  if (where === SPOT) return { day: end.day, spot: startingSpot(photo) };
  if (where === DAY_PHOTO) return { day: end.day };
  return { day: end.day, photo: Number(where) };
}

/** A photo's title, or else its ID. */
function photoTitle(photo: TripPhoto): string {
  return typeof photo.photo.title === "string" && photo.photo.title
    ? photo.photo.title
    : `Photo ${photo.id}`;
}

/** Where on its day the end is: the day's last or first photo, one picked from the day, or a spot. */
function WherePicker({ title, end, photo, photoWord, photos, onChange }: LegEndFieldProps) {
  return (
    <select
      value={whereValue(end)}
      aria-label={`${title}: where`}
      onChange={(e) => onChange(withWhere(end, e.target.value, photo))}
      className={SELECT_CLASS}
    >
      <option value={DAY_PHOTO}>The day's {photoWord}</option>
      {photos.map((p) => (
        <option key={p.id} value={String(p.id)}>
          {p.time} · {photoTitle(p)}
        </option>
      ))}
      <option value={SPOT}>A station or spot with no photo</option>
    </select>
  );
}

/** A new spot, where the day's photo is, to move from there; or at 0, 0 without one. */
function startingSpot(photo: TripPhoto | undefined) {
  return photo
    ? { latitude: photo.latitude, longitude: photo.longitude }
    : { latitude: 0, longitude: 0 };
}

interface PhotoNoteProps {
  photo: TripPhoto | undefined;
  photoWord: string;
  /** Whether the end names its photo, which the menu already shows. */
  named: boolean;
}

function PhotoNote({ photo, photoWord, named }: PhotoNoteProps) {
  if (!photo)
    return <p className="text-destructive text-xs">No photo with an exact spot on this day.</p>;
  if (named) return null;
  return (
    <p className="text-muted-foreground text-xs">
      The day's {photoWord}: {photoTitle(photo)} ({photo.time})
    </p>
  );
}

/** Whether the spot has been put somewhere, rather than left at 0, 0. */
function isPlaced(spot: TripLegEnd["spot"]): boolean {
  return Boolean(spot?.latitude || spot?.longitude);
}

/**
 * Where to look for the end's station: its spot once it has one, or else its day's photo; none for
 * a leg that rides no line, or a day with neither.
 */
function searchNear(mode: string, end: TripLegEnd, photo: TripPhoto | undefined) {
  if (!ridesLegLine(mode)) return undefined;
  return endSpot(isPlaced(end.spot) ? end : { day: end.day }, photo);
}

/**
 * An end at a spot with no photo: a station found by name for a train, bus or ferry, and the spot's
 * label and position, which picking a station fills in.
 */
function StationOrSpot({ title, mode, end, photo, onChange }: LegEndFieldProps) {
  const [picked, setPicked] = useState(0);
  const near = searchNear(mode, end, photo);
  return (
    <>
      {near && (
        <StationSearch
          title={title}
          mode={mode}
          near={near}
          onPick={(spot) => {
            onChange({ ...end, spot });
            setPicked((n) => n + 1);
          }}
        />
      )}
      <PointFields
        key={picked}
        point={end.spot!}
        title={title}
        placeholder="Hakata Port"
        onChange={(spot) => onChange({ ...end, spot })}
      />
    </>
  );
}
