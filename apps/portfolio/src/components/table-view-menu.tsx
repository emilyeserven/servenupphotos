import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  LOCATION_DETAIL_LABELS,
  LOCATION_DETAILS,
  type LocationDetail,
} from "@/lib/location-detail";

/**
 * The Table's **View** menu: how much of each photo's location the Place column shows, from only
 * the most specific place (the default) to its places, city and country.
 */
export function TableViewMenu({
  placeDetail,
  onPlaceDetailChange,
}: {
  placeDetail: LocationDetail;
  onPlaceDetailChange: (detail: LocationDetail) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto self-center">
          <Eye aria-hidden />
          View
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-52 flex-col gap-1 p-2">
        <fieldset className="flex flex-col gap-1">
          <legend className="px-2 pb-1 text-xs font-medium text-muted-foreground">
            Place names
          </legend>
          {LOCATION_DETAILS.map((detail) => (
            <label
              key={detail}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none hover:bg-accent"
            >
              <input
                type="radio"
                name="place-detail"
                checked={detail === placeDetail}
                onChange={() => onPlaceDetailChange(detail)}
                className="size-4 cursor-pointer accent-primary"
              />
              {LOCATION_DETAIL_LABELS[detail]}
            </label>
          ))}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
