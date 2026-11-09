import { useQuery } from "@tanstack/react-query";
import { Search, TrainFront } from "lucide-react";
import { useState } from "react";
import { type Spot, type TransitStation, transitStationsQuery } from "@/api/transit";
import { StationSourcePicker } from "@/components/trips/station-source-picker";
import { useStationSourceStore } from "@/stores/station-source";
import type { TripPoint } from "@/api/trip-lines";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StationSearchProps {
  /** What the end is, such as "Leaves". */
  title: string;
  /** The kind of line ridden, such as "train", whose stations are looked for. */
  mode: string;
  /** Where to look near: the end's day, as [longitude, latitude]. */
  near: Spot;
  onPick: (spot: TripPoint) => void;
}

/** A station's name, with its English one beside it when it has another, such as "博多 (Hakata)". */
function stationLabel(s: TransitStation): string {
  return s.nameEn ? `${s.name} (${s.nameEn})` : s.name;
}

/**
 * Finds a station or stop by name within 30 km of the end's day, from OpenStreetMap, and picking one
 * makes it the end's spot, labelled with its name, and closes the list.
 */
export function StationSearch({ title, mode, near, onPick }: StationSearchProps) {
  const [text, setText] = useState("");
  const [asked, setAsked] = useState("");
  const source = useStationSourceStore((s) => s.source);
  const stations = useQuery({
    ...transitStationsQuery({ mode, name: asked, near, source }),
    enabled: asked !== "",
  });
  return (
    <div className="flex flex-col gap-1">
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(text.trim());
        }}
      >
        <Input
          value={text}
          placeholder="Find a station, such as Hakata"
          aria-label={`${title}: find a station`}
          onChange={(e) => setText(e.target.value)}
        />
        <StationSourcePicker title={title} />
        <Button type="submit" variant="outline" size="icon" disabled={!text.trim()}>
          {stations.isFetching ? <Busy busy /> : <Search aria-hidden />}
          <span className="sr-only">Find a station</span>
        </Button>
      </form>
      {asked && (
        <StationChoices
          stations={stations.data}
          onPick={(spot) => {
            onPick(spot);
            setAsked("");
          }}
        />
      )}
      <SaveNote error={stations.error} why={stationsNote(asked, stations.data)} />
    </div>
  );
}

/** The stations found, each a button that makes it the end's spot. */
function StationChoices({
  stations = [],
  onPick,
}: {
  stations?: TransitStation[];
  onPick: (spot: TripPoint) => void;
}) {
  if (stations.length === 0) return null;
  return (
    <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-md border p-1">
      {stations.map((s) => (
        <li key={`${s.name}-${s.latitude}`}>
          <button
            type="button"
            className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm"
            onClick={() =>
              onPick({ label: s.nameEn ?? s.name, latitude: s.latitude, longitude: s.longitude })
            }
          >
            <TrainFront className="text-muted-foreground size-3.5" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{stationLabel(s)}</span>
            <span className="text-muted-foreground text-xs">{s.km} km</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** What the search found, said when it found none. */
function stationsNote(asked: string, stations: TransitStation[] | undefined): string {
  if (!asked || stations === undefined || stations.length > 0) return "";
  return `No station named "${asked}" within 30 km of this day.`;
}
