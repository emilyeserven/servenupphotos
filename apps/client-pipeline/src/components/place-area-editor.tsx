import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import type { Area } from "@/api/areas";
import {
  deletePlaceAreaMutation,
  type PlaceArea,
  placeAreaQuery,
  savePlaceAreaMutation,
} from "@/api/place-areas";
import { AreaSearch } from "@/components/area-search";
import { Button } from "@/components/ui/button";

/** How many points an outline has. */
function pointCount(area: PlaceArea): number {
  return area.shape.flat(2).length;
}

/**
 * A place's area, such as a park's outline, which the portfolio's map shades while a visitor points
 * at the place in its Places menu, and after picking it: found on OpenStreetMap by name or Wikidata
 * ID, saved as a change waiting for Commit, or removed.
 */
export function PlaceAreaEditor({ id, name }: { id: string; name: string }) {
  const queryClient = useQueryClient();
  const area = useQuery(placeAreaQuery(id));
  const refresh = { onSuccess: () => queryClient.invalidateQueries(placeAreaQuery(id)) };
  const save = useMutation(savePlaceAreaMutation);
  const remove = useMutation(deletePlaceAreaMutation);
  const pick = ({ osm, shape }: Area) => save.mutate({ id, area: { osm, shape } }, refresh);
  return (
    <section className="flex flex-col gap-2 border-t pt-4" aria-labelledby="place-area-title">
      <h3 id="place-area-title" className="text-sm font-medium">
        Area on the map
      </h3>
      <p className="text-muted-foreground text-xs">
        The outline the portfolio's map shades while a visitor points at this place in its Places
        menu, and after picking it. Saved next to the place as its own file, so PLACES.json stays
        small.
      </p>
      <AreaStatus
        area={area.data}
        busy={remove.isPending}
        onRemove={() => remove.mutate(id, refresh)}
      />
      <AreaSearch initial={name} onPick={pick} />
      <AreaError error={save.error ?? remove.error} />
    </section>
  );
}

/** Why the last save or removal failed, when it did. */
function AreaError({ error }: { error: Error | null }) {
  return error ? <p className="text-destructive text-xs">{error.message}</p> : null;
}

interface AreaStatusProps {
  area: PlaceArea | null | undefined;
  busy: boolean;
  onRemove: () => void;
}

/** Whether the place has an area, how detailed it is, and removing it. */
function AreaStatus({ area, busy, onRemove }: AreaStatusProps) {
  if (!area) return <p className="text-sm">No area yet.</p>;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>
        An outline of {pointCount(area)} points{area.osm && ` from OpenStreetMap ${area.osm}`}.
      </span>
      <Button variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
        <Trash2 aria-hidden />
        Remove
      </Button>
    </div>
  );
}
