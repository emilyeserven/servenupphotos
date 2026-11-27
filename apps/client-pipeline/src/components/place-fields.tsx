import { useState } from "react";
import type { Place, PhotoPlace } from "@/api/places";
import type { LocationPrompt } from "@/components/edit-in-flight/location-prompt";
import { PhotoGpsStatus } from "@/components/photo-gps-status";
import { PlaceCityAdders } from "@/components/place-city-adder";
import { ParentOffer, PlaceFooter } from "@/components/place-fields/place-footer";
import { PlaceRow } from "@/components/place-fields/place-row";
import { usePlaces } from "@/components/place-fields/use-places";
import { PlaceGpsAdders } from "@/components/place-gps-adder";
import { PlaceScopeNote, usePlaceScope } from "@/components/place-scope";
import { Input } from "@/components/ui/input";
import { placeCity, specificFirst, swappedPlaces, withParent } from "@/lib/place-hierarchy";
import { rowJoin, withBetweenJoin } from "@/lib/place-joins";

/**
 * What PlaceFields edits: the photo's places, the place name kept with them, and its custom city
 * and country, which choosing a place with a city fills in.
 */
interface PlaceValue {
  places: PhotoPlace[];
  placeName: string;
  customCity: string;
  customCountry: string;
  /** The photo's custom GPS position, which the map uses before its EXIF one or its places'. */
  customGpsPosition?: string;
}

/** The photo's own GPS position, from its EXIF or else written on the page; null when it has neither. */
function ownGps(exifGps: string | null, value: PlaceValue): string | null {
  return exifGps || value.customGpsPosition?.trim() || null;
}

/** A place row with nothing chosen yet. */
const NO_PLACE: PhotoPlace = { relation: "", id: "" };

/** The first place chosen, if any. */
function firstChosen(places: PhotoPlace[]): PhotoPlace | undefined {
  return places.find((place) => place.id);
}

/**
 * The place name to keep with places: the first chosen place's name, so the portfolio keeps
 * showing a name; empty once the places that set it are all removed; or else the one written before
 * there were places, as it was.
 */
function nextPlaceName(previous: PlaceValue, places: PhotoPlace[], names: Map<string, string>) {
  const first = firstChosen(places);
  if (first) return names.get(first.id) ?? first.id;
  return firstChosen(previous.places) ? "" : previous.placeName;
}

interface PlaceFieldsProps {
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  disabled: boolean;
  /** The country from the photo's EXIF, for telling whether it was taken in the United States. */
  exifCountry: string | null;
  /** The GPS position in the photo's EXIF, or null when it has none. */
  exifGps: string | null;
  /** The city from the photo's EXIF, offered as a place's city when its custom one is empty. */
  exifCity: string | null;
  /** The location prompt's sparkle button and answer field, when the photo has one. */
  prompt?: LocationPrompt;
}

/**
 * rows after the place in row `index` changed: its parent added as the second place when it's the
 * only one, and the more specific place first.
 */
function afterChoosing(rows: PhotoPlace[], index: number, places: Place[]): PhotoPlace[] {
  return specificFirst(withParent(rows, index, places), places);
}

/** The custom city and country, filled in from the places when one of them has a city. */
function cityFor(value: PlaceValue, rows: PhotoPlace[], places: Place[]) {
  const { city = "", country = "" } = placeCity(rows, places) ?? {};
  return { customCity: city || value.customCity, customCountry: country || value.customCountry };
}

/** The city the photo shows: its custom one, or else its EXIF one. */
function photoCity(value: PlaceValue, exifCity: string | null): string {
  return value.customCity.trim() || exifCity || "";
}

/** The country the photo was taken in, as far as is known: the custom one, or else the EXIF's. */
function photoCountry(value: PlaceValue, exifCountry: string | null): string {
  return value.customCountry.trim() || exifCountry || "";
}

/**
 * Where the photo was taken: one place from PLACES.json, or two, each with how the photo relates to
 * it ("In Gyeongbokgung Palace by Geunjeongmun Gate"), or one with just a relation ("Near
 * Gyeongbokgung"). A place can be added from what's typed. The first place's name is kept as the
 * place name the portfolio shows.
 */
export function PlaceFields({
  value,
  onChange,
  disabled,
  exifCountry,
  exifGps,
  exifCity,
  prompt,
}: PlaceFieldsProps) {
  const all = usePlaces();
  // The place name as the photo was saved, kept while editing even once places replace it.
  const [oldName] = useState(() => (hasOldPlaceName(value) ? value.placeName.trim() : ""));
  const rows = value.places.length > 0 ? value.places : [NO_PLACE];
  const setRows = (next: PhotoPlace[], city = {}) => {
    const places = withBetweenJoin(next);
    onChange({ ...value, ...city, places, placeName: nextPlaceName(value, places, all.names) });
  };
  const setRow = (index: number, row: PhotoPlace) => {
    if (row.id === rows[index]?.id) return setRows(rows.with(index, row));
    const next = afterChoosing(rows.with(index, row), index, all.places);
    setRows(next, cityFor(value, next, all.places));
  };
  const country = photoCountry(value, exifCountry);
  const city = photoCity(value, exifCity);
  const scope = usePlaceScope({ city, country, rows, ...all });
  return (
    <div className="flex flex-col gap-2">
      <PlaceLabel prompt={prompt} />
      <PhotoGpsStatus
        exifGps={exifGps}
        customGps={value.customGpsPosition}
        rows={rows}
        places={all.places}
      />
      <PlaceGpsAdders
        rows={rows}
        places={all.places}
        exifGps={ownGps(exifGps, value)}
        disabled={disabled}
      />
      <PlaceCityAdders
        rows={rows}
        places={all.places}
        region={{ city, country }}
        disabled={disabled}
      />
      {oldName && <OldPlaceName name={oldName} />}
      <PlaceScopeNote {...scope} onShowAll={scope.setShowAll} />
      {rows.map((row, index) => (
        <PlaceRow
          key={index}
          index={index}
          row={row}
          all={all}
          disabled={disabled}
          onChange={(next) => setRow(index, next)}
          onRemove={index > 0 ? () => setRows(rows.toSpliced(index, 1)) : undefined}
          country={country}
          joined={rowJoin(rows, index, all.places)}
          menu={scope.menuFor(index, row.id)}
        />
      ))}
      <PlaceFooter
        rows={rows}
        all={all}
        disabled={disabled}
        onAddSecond={() => setRows([...rows, { relation: "by", id: "" }])}
        onSwap={() => setRows(swappedPlaces(rows))}
      />
      <ParentOffer rows={rows} all={all} disabled={disabled} />
    </div>
  );
}

/** The Place label, with the location prompt's sparkle button and, once it's copied, its answer field. */
function PlaceLabel({ prompt }: { prompt?: LocationPrompt }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span id="photo-place-label" className="text-sm font-medium">
          Place
        </span>
        {prompt?.button}
      </div>
      {prompt?.answer}
    </>
  );
}

/** Whether the photo has a place name but no places, as photos saved before places do. */
function hasOldPlaceName(value: PlaceValue): boolean {
  return !firstChosen(value.places) && Boolean(value.placeName.trim());
}

/**
 * The place name a photo was saved with before it had places, read-only, to choose or add the
 * matching places by. Once the photo is saved with places, it isn't shown anymore.
 */
function OldPlaceName({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="photo-old-place-name" className="text-muted-foreground text-xs">
        Place name saved before places, for reference
      </label>
      <Input id="photo-old-place-name" value={name} readOnly className="bg-muted/50" />
    </div>
  );
}
