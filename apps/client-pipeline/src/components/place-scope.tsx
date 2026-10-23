import { useState } from "react";
import type { Localization, Place } from "@/api/places";
import type { ComboboxOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { locationNames } from "@/lib/location-names";
import { type PlaceScope, placeScope, scopedOptions } from "@/lib/place-scope";

interface PlaceScopeInput {
  /** The photo's city and country: custom, or else from its EXIF. */
  city: string;
  country: string;
  places: Place[];
  localizations: Localization[];
  /** Every place's option, and the inferred places'. */
  options: ComboboxOption[];
}

/**
 * Which places the place menus list: only those in the photo's city, or its country when it has no
 * city, until "Show all places" is chosen. Every place is listed when the photo has neither.
 */
export function usePlaceScope({ city, country, places, localizations, options }: PlaceScopeInput) {
  const [showAll, setShowAll] = useState(false);
  const names = locationNames(localizations);
  const scope = placeScope(city, country, names);
  const active = showAll ? undefined : scope;
  /** The options for a menu whose chosen place is chosen. */
  const optionsFor = (chosen: string) =>
    active ? scopedOptions(options, places, active, names, chosen) : options;
  const emptyText = active
    ? `No places in ${active.name} yet. Type a name to add one, or show all places.`
    : "No places yet. Type a name to add one.";
  return { scope, showAll, setShowAll, optionsFor, emptyText };
}

interface PlaceScopeNoteProps {
  scope: PlaceScope | undefined;
  showAll: boolean;
  onShowAll: (showAll: boolean) => void;
}

/** Says which places the menus list, with a button to list every place or only the scope's again. */
export function PlaceScopeNote({ scope, showAll, onShowAll }: PlaceScopeNoteProps) {
  if (!scope) return null;
  return (
    <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-2 text-xs">
      <span>{showAll ? "Listing every place." : `Listing places in ${scope.name}.`}</span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        onClick={() => onShowAll(!showAll)}
      >
        {showAll ? `Only places in ${scope.name}` : "Show all places"}
      </Button>
    </div>
  );
}
