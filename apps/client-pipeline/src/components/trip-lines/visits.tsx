import { ExternalLink, MapPinPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Place } from "@/api/places";
import type { TripPoint, TripVisit, VisitKind } from "@/api/trip-lines";
import { CasualPhotos, useClearCasual } from "@/components/trip-lines/casual-photos";
import { StationStopAdder } from "@/components/trip-lines/station-stop-adder";
import { VISIT_ICONS } from "@/components/trip-lines/visit-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentLists } from "@/lib/group-photos";
import { writtenPosition } from "@/lib/place-gps";
import type { TripDay } from "@/lib/trip-days";
import type { GapDraft } from "@/lib/trip-gaps";
import {
  changedVisit,
  newVisit,
  placesNear,
  placeVisit,
  VISIT_KINDS,
  webLink,
  withVisit,
} from "@/lib/trip-visits";
import { useCombinedData } from "@/stores/combined-data";

interface VisitsProps {
  day: TripDay;
  draft: GapDraft;
  onChange: (draft: GapDraft) => void;
  /** Whether the next map click adds a stop. */
  picking: boolean;
  onPicking: (on: boolean) => void;
}

/**
 * The day's trip stops, such as restaurants and museums, with or without a photo: added by
 * clicking the map, from the saved places nearby or by a coordinate, each with a kind, a note and a
 * link to it on Google Maps, Naver Map or another map. Each one's Where on the route menu, or the
 * photo strip on Route, puts it on the route.
 */
export function Visits({ day, draft, onChange, picking, onPicking }: VisitsProps) {
  const visits = draft.visits ?? [];
  return (
    <div className="flex flex-col gap-2">
      {visits.map((visit, i) => (
        <VisitRow
          key={i}
          visit={visit}
          day={day}
          onChange={(v) => onChange(changedVisit(draft, i, v))}
        />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={picking ? "secondary" : "outline"}
          size="sm"
          onClick={() => onPicking(!picking)}
        >
          <MapPinPlus aria-hidden />
          {picking ? "Click the map where it is…" : "Add a stop on the map"}
        </Button>
        <SavedPlacePicker
          spots={nearbySpots(day, draft)}
          onPick={(v) => onChange(withVisit(draft, v))}
        />
        <CoordinateAdder onAdd={(v) => onChange(withVisit(draft, v))} />
        <StationStopAdder
          near={nearbySpots(day, draft)[0]}
          onAdd={(v) => onChange(withVisit(draft, v))}
        />
      </div>
    </div>
  );
}

/** The spots saved places are looked for near: the day's photos and its trip stops. */
function nearbySpots(day: TripDay, draft: GapDraft): TripPoint[] {
  return [...day.photos, ...(draft.visits ?? [])];
}

/** The saved places, from the combined lists. */
function useSavedPlaces(): Place[] {
  const data = useCombinedData().data;
  return data ? ((currentLists(data).places.data ?? []) as Place[]) : [];
}

/**
 * Adds one of the saved places near the day's photos or its trip stops as a trip stop, so a day
 * planned before its photos gets nearby places once its first stop is added.
 */
function SavedPlacePicker({
  spots,
  onPick,
}: {
  spots: TripPoint[];
  onPick: (v: TripVisit) => void;
}) {
  const near = placesNear(useSavedPlaces(), spots);
  if (near.length === 0) return null;
  return (
    <select
      aria-label="Add a saved place"
      className="border-input bg-background h-8 rounded-md border px-2 text-sm"
      value=""
      onChange={(e) => onPick(placeVisit(near[+e.target.value]!))}
    >
      <option value="">Add a saved place nearby…</option>
      {near.map((p, i) => (
        <option key={p.id} value={i}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

interface VisitRowProps {
  visit: TripVisit;
  day: TripDay;
  /** Changes the visit, or removes it with null. */
  onChange: (visit: TripVisit | null) => void;
}

/** One trip stop: its kind, name, note, map link, where it is on the route, and removing it. */
function VisitRow({ visit, day, onChange }: VisitRowProps) {
  const set = (fields: Partial<TripVisit>) => onChange({ ...visit, ...fields });
  const clearCasual = useClearCasual(day.day);
  const Icon = VISIT_ICONS[visit.kind];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <Icon className="text-muted-foreground size-4" aria-hidden />
      <select
        aria-label="Kind of stop"
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
        value={visit.kind}
        onChange={(e) => set({ kind: e.target.value as VisitKind })}
      >
        {VISIT_KINDS.map(({ kind, label }) => (
          <option key={kind} value={kind}>
            {label}
          </option>
        ))}
      </select>
      <Input
        aria-label="Name"
        placeholder="Name (needed)"
        className="h-8 w-48"
        value={visit.name}
        onChange={(e) => set({ name: e.target.value })}
      />
      <Input
        aria-label="Note"
        placeholder="Note"
        className="h-8 w-56"
        value={visit.note ?? ""}
        onChange={(e) => set({ note: e.target.value })}
      />
      <LinkField link={visit.link} onLink={(link) => set({ link })} />
      <RouteSpot photos={day.photos} visit={visit} onChange={onChange} />
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Remove"
        onClick={() => {
          clearCasual(visit.photos);
          onChange(null);
        }}
      >
        <Trash2 className="size-4" aria-hidden />
        <span className="sr-only">Remove</span>
      </Button>
      <CasualPhotos day={day.day} visit={visit} onChange={onChange} />
    </div>
  );
}

/** The place's link on an outside map, and a button that opens it once it's a web address. */
function LinkField({ link, onLink }: { link?: string; onLink: (link: string) => void }) {
  return (
    <span className="flex items-center gap-1">
      <Input
        aria-label="Map link"
        placeholder="Google Maps or Naver Map link"
        className="h-8 w-64"
        value={link ?? ""}
        onChange={(e) => onLink(e.target.value)}
      />
      {webLink(link) && (
        <a href={link} target="_blank" rel="noreferrer" title="Open the map link" className="p-1">
          <ExternalLink className="size-4" aria-hidden />
        </a>
      )}
    </span>
  );
}

interface RouteSpotProps {
  photos: TripDay["photos"];
  visit: TripVisit;
  onChange: (visit: TripVisit) => void;
}

/**
 * Where the stop is on the route, picked from a menu: not on it, before the first photo (where the
 * route starts), or after a photo, between it and the next or, after the last, where it ends. The
 * photo strip on Route sets the same.
 */
function RouteSpot({ photos, visit, onChange }: RouteSpotProps) {
  return (
    <select
      aria-label="Where on the route"
      className="border-input bg-background h-8 rounded-md border px-2 text-sm"
      value={spotValue(visit)}
      onChange={(e) => onChange(atSpot(visit, e.target.value))}
    >
      <option value="">Not on the route</option>
      {photos.length > 0 && <option value="first">Before photo 1, where the route starts</option>}
      {photos.map((p, i) => (
        <option key={p.id} value={p.id}>
          {spotLabel(i, photos.length)}
        </option>
      ))}
    </select>
  );
}

/** The stop's place on the route as the menu's value. */
function spotValue({ first, after }: TripVisit): string {
  if (first) return "first";
  return after === undefined ? "" : String(after);
}

/** How the menu names the place after the photo at index i of n. */
function spotLabel(i: number, n: number): string {
  if (i === n - 1) return `After photo ${i + 1}, where the route ends`;
  return `Between photos ${i + 1} and ${i + 2}`;
}

/** The stop moved to the place the menu's value names. */
function atSpot(visit: TripVisit, value: string): TripVisit {
  const { after: _after, first: _first, ...rest } = visit;
  if (value === "first") return { ...rest, first: true };
  return value === "" ? rest : { ...rest, after: Number(value) };
}

/** Adds a trip stop at a coordinate typed or pasted in, such as from Google Maps. */
function CoordinateAdder({ onAdd }: { onAdd: (visit: TripVisit) => void }) {
  const [text, setText] = useState("");
  const point = pointOf(text);
  const add = () => {
    if (!point) return;
    onAdd(newVisit(point));
    setText("");
  };
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <Input
        aria-label="Coordinate"
        placeholder="34.6688, 135.5026"
        className="h-8 w-48"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" variant="outline" size="sm" disabled={!point}>
        Add at this coordinate
      </Button>
    </form>
  );
}

/** The latitude and longitude written in text, in decimal degrees or degrees and minutes; none when it isn't one. */
function pointOf(text: string): TripPoint | undefined {
  return writtenPosition(text) ?? undefined;
}
