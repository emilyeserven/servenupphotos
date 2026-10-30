import { ChevronsUpDown, MapPin } from "lucide-react";
import { useState } from "react";
import { PlacesPanel } from "@/components/places-filter";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { locationOptions } from "@/lib/filter-options";
import type { PlacedPhoto } from "@/lib/map-photos";
import { filterPhotos, locationFilters } from "@/lib/photo-filters";

/**
 * The map's **Places** button: the same searchable tree of countries, cities and places as the
 * Places filter, but picking one moves the map to its photos and closes the tree, rather than
 * filtering the photos. `photos` are the ones the map's filters leave, which the tree lists and
 * counts, and `onPick` gets the picked place's photos.
 */
export function MapPlacePicker({
  photos,
  onPick,
}: {
  photos: PlacedPhoto[];
  onPick: (photos: PlacedPhoto[]) => void;
}) {
  const [open, setOpen] = useState(false);

  /** Moves the map to the place's photos and closes the tree. */
  function pick(value: string) {
    setOpen(false);
    onPick(filterPhotos(photos, locationFilters([value])));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      {open && <PlacesPanel options={locationOptions(photos, photos)} onChoose={pick} />}
    </Popover>
  );
}
