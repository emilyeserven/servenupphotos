import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cacheSavedEntry, type Place, savePlaceMutation } from "@/api/places";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { type InferredPlace, inferredPlaces } from "@/lib/inferred-places";
import { shownPhotos } from "@/lib/place-seeds";
import { useCombinedData } from "@/stores/combined-data";

/**
 * The place names written on two or more photos that aren't saved places yet, each with a button to
 * save it as a place. Nothing shows when there are none.
 */
export function InferredPlaceList({ places }: { places: Place[] }) {
  const inferred = inferredPlaces(shownPhotos(useCombinedData().data), places);
  if (inferred.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 border-t pt-4" aria-labelledby="inferred-places">
      <div>
        <h3 id="inferred-places" className="text-sm font-medium">
          Inferred places
        </h3>
        <p className="text-muted-foreground text-sm">
          Place names on more than one photo that aren't places yet. They can be chosen on the Photo
          page too, which saves them.
        </p>
      </div>
      <ul className="flex flex-col divide-y">
        {inferred.map((place) => (
          <InferredPlaceItem key={place.id} place={place} />
        ))}
      </ul>
    </section>
  );
}

/** One inferred place, with how many photos have its name and a button to save it. */
function InferredPlaceItem({ place }: { place: InferredPlace }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    ...savePlaceMutation,
    onSuccess: (result) => cacheSavedEntry(queryClient, "places", result),
  });
  return (
    <li className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{place.name}</div>
        <div className="text-muted-foreground text-xs">
          <code>{place.id}</code> · on {place.photos} photos
        </div>
        {save.error && <p className="text-destructive text-sm">{save.error.message}</p>}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={save.isPending}
        onClick={() => save.mutate({ id: place.id, name: place.name, description: "" })}
      >
        {save.isPending && <Spinner />}
        Save as a place
      </Button>
    </li>
  );
}
