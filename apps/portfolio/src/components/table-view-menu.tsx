import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type CommonSize, sizeChoices } from "@/lib/grid-size";
import {
  LOCATION_DETAIL_LABELS,
  LOCATION_DETAILS,
  type LocationDetail,
} from "@/lib/location-detail";

/** The Place names choices with their labels, in order. */
const PLACE_CHOICES = LOCATION_DETAILS.map((detail) => [
  detail,
  LOCATION_DETAIL_LABELS[detail],
]) as [LocationDetail, string][];

/** The thumbnail sizes with their labels, in order. */
const SIZE_CHOICES = sizeChoices("table") as [CommonSize, string][];

/**
 * The Table's **View** menu: how big the thumbnails are, from Small (the default) to Large, and how
 * much of each photo's location the Place column shows, from only the most specific place (the
 * default) to its places, city and country.
 */
export function TableViewMenu({
  size,
  onSizeChange,
  placeDetail,
  onPlaceDetailChange,
}: {
  size: CommonSize;
  onSizeChange: (size: CommonSize) => void;
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
      <PopoverContent align="end" className="flex w-52 flex-col gap-3 p-2">
        <RadioChoices
          legend="Size"
          name="thumbnail-size"
          choices={SIZE_CHOICES}
          value={size}
          onChange={onSizeChange}
        />
        <RadioChoices
          legend="Place names"
          name="place-detail"
          choices={PLACE_CHOICES}
          value={placeDetail}
          onChange={onPlaceDetailChange}
        />
      </PopoverContent>
    </Popover>
  );
}

/** One of the menu's sections: a legend over a radio button for each choice. */
function RadioChoices<T extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  choices: [T, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="px-2 pb-1 text-xs font-medium text-muted-foreground">{legend}</legend>
      {choices.map(([choice, label]) => (
        <label
          key={choice}
          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none hover:bg-accent"
        >
          <input
            type="radio"
            name={name}
            checked={choice === value}
            onChange={() => onChange(choice)}
            className="size-4 cursor-pointer accent-primary"
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
