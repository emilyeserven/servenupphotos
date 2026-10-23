import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2Icon } from "lucide-react";
import { useState } from "react";
import { optimisticEntry, type PhotoPlace, type Place, savePlaceMutation } from "@/api/places";
import { PlaceCityField } from "@/components/place-city-field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cityOfPlace } from "@/lib/place-cities";

/** The city and country the photo shows, offered as a place's. */
interface PhotoRegion {
  city: string;
  country: string;
}

interface PlaceCityAddersProps {
  /** The photo's places, in order. */
  rows: PhotoPlace[];
  places: Place[];
  region: PhotoRegion;
  disabled: boolean;
}

/**
 * A way to give each of the photo's places that's in no city, by itself or a place above it, a
 * city without leaving the page.
 */
export function PlaceCityAdders({ rows, places, region, disabled }: PlaceCityAddersProps) {
  const chosen = rows.flatMap((row) => places.filter((place) => place.id === row.id));
  return chosen
    .filter((place) => !cityOfPlace(place, places))
    .map((place) => (
      <PlaceCityAdder
        key={place.id}
        place={place}
        places={places}
        region={region}
        disabled={disabled}
      />
    ));
}

interface PlaceCityAdderProps {
  place: Place;
  places: Place[];
  region: PhotoRegion;
  disabled: boolean;
}

/** A button that opens a city field for a place in no city, saved to the place like on the Places page. */
function PlaceCityAdder({ place, places, region, disabled }: PlaceCityAdderProps) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto justify-start p-0 text-xs"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Building2Icon />
        Set a city for {place.name}
      </Button>
    );
  }
  return (
    <PlaceCityForm place={place} places={places} region={region} onClose={() => setOpen(false)} />
  );
}

interface PlaceCityFormProps {
  place: Place;
  places: Place[];
  region: PhotoRegion;
  onClose: () => void;
}

/** The place with the city, and its country when the place has none. */
function withCity(place: Place, { city, country }: PhotoRegion): Place {
  return { ...place, city, country: place.country || country };
}

/** The place's city, starting from the photo's, and Save. */
function PlaceCityForm({ place, places, region, onClose }: PlaceCityFormProps) {
  const queryClient = useQueryClient();
  const save = useMutation({ ...savePlaceMutation, ...optimisticEntry(queryClient, "places") });
  const [chosen, setChosen] = useState<PhotoRegion>(region);
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <PlaceCityField
        id={`place-city-${place.id}`}
        label={`City for ${place.name}`}
        value={chosen.city}
        places={places}
        disabled={save.isPending}
        help="Photos given this place take this city and its country. It starts as the city this photo shows."
        onChange={(city, country) => setChosen((c) => ({ city, country: country || c.country }))}
      />
      {save.error && <p className="text-destructive text-xs">{save.error.message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!chosen.city.trim() || save.isPending}
          onClick={() => save.mutate(withCity(place, chosen), { onSuccess: onClose })}
        >
          {save.isPending && <Spinner />}
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
