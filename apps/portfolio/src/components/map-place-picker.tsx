import { ChevronsUpDown, MapPin } from "lucide-react";
import { useState } from "react";
import { PlacesPanel } from "@/components/place-columns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { locationOptions } from "@/lib/filter-options";
import type { PlacedPhoto } from "@/lib/map-photos";
import { filterPhotos, locationFilters } from "@/lib/photo-filters";

/**
 * The map's **Places** button: the same searchable columns of countries, regions, cities and places
 * as the Places filter, but picking one moves the map to its photos and closes them, rather than
 * filtering the photos. `photos` are the ones the map's filters leave, which the tree lists and
 * counts, and `onPick` gets the picked place's photos. Pointing at a place with an area shades it
 * on the map (see place-areas.ts).
 */
export function MapPlacePicker({
  photos,
  onPick,
  onHover,
}: {
  photos: PlacedPhoto[];
  /** Gets the picked place's photos and its location value, such as "place:osaka-castle-park". */
  onPick: (photos: PlacedPhoto[], value: string) => void;
  /** Gets the location value pointed at in the tree, and undefined after or once it closes. */
  onHover: (value: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  /** Opens or closes the tree, forgetting what was pointed at when it closes. */
  function toggle(next: boolean) {
    setOpen(next);
    if (!next) onHover(undefined);
  }

  /** Moves the map to the place's photos and closes the tree. */
  function pick(value: string) {
    toggle(false);
    onPick(filterPhotos(photos, locationFilters([value])), value);
  }

  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Go to a place"
          title="Go to a place"
          className="relative bg-background font-normal has-[>svg]:pr-8 dark:bg-background"
        >
          <MapPin aria-hidden className="text-muted-foreground" />
          Places
          <ChevronsUpDown aria-hidden className="absolute right-2.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      {open && (
        <PlacesPanel options={locationOptions(photos, photos)} onChoose={pick} onHover={onHover} />
      )}
    </Popover>
  );
}
