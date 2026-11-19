import { ChevronsUpDown, Globe, MapPin, Route } from "lucide-react";
import { useState } from "react";
import { MapTripToggles } from "@/components/map-trip-toggles";
import { PlacesBody } from "@/components/place-columns";
import { SectionPicker } from "@/components/section-picker";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { locationOptions } from "@/lib/filter-options";
import type { MapDisplay } from "@/lib/map-display";
import type { PlacedPhoto } from "@/lib/map-photos";
import { filterPhotos, locationFilters } from "@/lib/photo-filters";

/** The Places menu's tabs: going to a country's places, or each Trip's trip lines. */
type PlacesTab = "country" | "trip";

/**
 * The map's **Places** button, whose menu has two tabs, like **Groups**. **Country** has the same
 * searchable columns of countries, regions, cities and places as the Places filter, but picking one
 * moves the map to its photos and closes them, rather than filtering the photos. `photos` are the
 * ones the map's filters leave, which the tree lists and counts, and `onPick` gets the picked
 * place's photos. Pointing at a place with an area shades it on the map (see place-areas.ts).
 * **Trip** lists the Trips with trip lines on those photos' days, each with a checkbox showing or
 * hiding its lines (see `MapTripToggles`).
 */
export function MapPlacePicker({
  photos,
  onPick,
  onHover,
  display,
  onDisplayChange,
}: MenuProps & {
  /** Gets the picked place's photos and its location value, such as "place:osaka-castle-park". */
  onPick: (photos: PlacedPhoto[], value: string) => void;
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
        <PopoverContent
          align="start"
          collisionPadding={16}
          className="w-auto max-w-[calc(100vw-2rem)] p-0"
        >
          <PlacesMenu
            photos={photos}
            onPick={pick}
            onHover={onHover}
            display={display}
            onDisplayChange={onDisplayChange}
          />
        </PopoverContent>
      )}
    </Popover>
  );
}

/** What the Places menu shows, and what choosing in it does. */
interface MenuProps {
  /** The photos the map's filters leave. */
  photos: PlacedPhoto[];
  /** Gets the location value pointed at in the tree, and undefined after or once it closes. */
  onHover: (value: string | undefined) => void;
  display: MapDisplay;
  onDisplayChange: (change: Partial<MapDisplay>) => void;
}

/** The menu's Country and Trip tabs on the left, and the chosen tab's contents. */
function PlacesMenu({ onPick, ...props }: MenuProps & { onPick: (value: string) => void }) {
  const [tab, setTab] = useState<PlacesTab>("country");
  const hidden = props.display.hiddenTrips.length;
  return (
    <SectionPicker
      label="Places"
      sections={[
        { key: "country", label: "Country", text: "Go to a place", Icon: Globe },
        { key: "trip", label: "Trip", text: hiddenText(hidden), set: hidden > 0, Icon: Route },
      ]}
      chosen={tab}
      onChoose={setTab}
      width="sm:w-[38rem]"
    >
      {tab === "country" ? (
        <div className="-m-3 flex flex-col">
          <PlacesBody
            options={locationOptions(props.photos, props.photos)}
            onChoose={onPick}
            onHover={props.onHover}
          />
        </div>
      ) : (
        <MapTripToggles {...props} />
      )}
    </SectionPicker>
  );
}

/** What the Trip tab says under its name: whether every Trip's lines are shown. */
function hiddenText(hidden: number): string {
  return hidden === 0
    ? "All trip lines shown"
    : `${hidden} ${hidden === 1 ? "trip" : "trips"} hidden`;
}
