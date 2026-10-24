import { useState } from "react";
import type { Localization, PhotoPlace, Place } from "@/api/places";
import type { ComboboxOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { locationNames } from "@/lib/location-names";
import { idsInScope, idsInside, optionsWith, placeScope } from "@/lib/place-scope";

/** The places a place menu lists, and what it says when none matches. */
export interface PlaceMenu {
  options: ComboboxOption[];
  emptyText: string;
}

/** Which places a menu lists: those with the IDs, which are in the place, city or country named. */
interface MenuFilter {
  name: string;
  ids: Set<string>;
}

interface PlaceScopeInput {
  /** The photo's city and country: custom, or else from its EXIF. */
  city: string;
  country: string;
  places: Place[];
  localizations: Localization[];
  /** Every place's option, and the inferred places'. */
  options: ComboboxOption[];
  /** The photo's place rows, the more specific place first. */
  rows: PhotoPlace[];
}

/** The places in the photo's city, or its country when it has no city; undefined when it has neither. */
function cityFilter({ city, country, places, localizations }: PlaceScopeInput) {
  const names = locationNames(localizations);
  const scope = placeScope(city, country, names);
  return scope && { name: scope.name, ids: idsInScope(places, scope, names) };
}

/** The places in the second row's place, for the first row; undefined until one is chosen. */
function insideFilter({ rows, places }: PlaceScopeInput): MenuFilter | undefined {
  const parent = places.find((place) => place.id === rows[1]?.id);
  return parent && { name: parent.name || parent.id, ids: idsInside(places, parent.id) };
}

/** The menu for a filter: its places and the chosen one, or every option when there's no filter. */
function menuOf(filter: MenuFilter | undefined, options: ComboboxOption[], chosen: string) {
  if (!filter) return { options, emptyText: "No places yet. Type a name to add one." };
  return {
    options: optionsWith(options, filter.ids, chosen),
    emptyText: `No places in ${filter.name} yet. Type a name to add one, or show all places.`,
  };
}

/**
 * Which places the place menus list: only those in the photo's city, or its country when it has no
 * city, and for the first row only those in the second row's place, until "Show all places" is
 * chosen. Every place is listed when there's nothing to go by.
 */
export function usePlaceScope(input: PlaceScopeInput) {
  const [showAll, setShowAll] = useState(false);
  const inCity = cityFilter(input);
  const inside = insideFilter(input);
  const filterFor = (index: number) => (index === 0 && inside) || inCity;
  /** The menu for row `index`, whose chosen place is chosen. */
  const menuFor = (index: number, chosen: string): PlaceMenu =>
    menuOf(showAll ? undefined : filterFor(index), input.options, chosen);
  return { inCity, inside, showAll, setShowAll, menuFor };
}

interface PlaceScopeNoteProps {
  inCity: MenuFilter | undefined;
  inside: MenuFilter | undefined;
  showAll: boolean;
  onShowAll: (showAll: boolean) => void;
}

/** What the menus list, as in "Listing places in Seoul; places in Gyeongbokgung Palace for the first place." */
function listingText(inCity: MenuFilter | undefined, inside: MenuFilter | undefined): string {
  const parts = [
    inCity && `places in ${inCity.name}`,
    inside && `places in ${inside.name} for the first place`,
  ];
  return `Listing ${parts.filter(Boolean).join("; ")}.`;
}

/** Says which places the menus list, with a button to list every place or only the matching ones again. */
export function PlaceScopeNote({ inCity, inside, showAll, onShowAll }: PlaceScopeNoteProps) {
  if (!inCity && !inside) return null;
  return (
    <ScopeToggle
      text={showAll ? "Listing every place." : listingText(inCity, inside)}
      showAll={showAll}
      onShowAll={onShowAll}
    />
  );
}

interface ScopeToggleProps {
  text: string;
  showAll: boolean;
  onShowAll: (showAll: boolean) => void;
}

/** The note's text, and the button that lists every place or only the matching ones. */
function ScopeToggle({ text, showAll, onShowAll }: ScopeToggleProps) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-2 text-xs">
      <span>{text}</span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        onClick={() => onShowAll(!showAll)}
      >
        {showAll ? "Only matching places" : "Show all places"}
      </Button>
    </div>
  );
}
