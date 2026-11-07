import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shapes, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Area } from "@/api/areas";
import {
  deletePlaceAreaMutation,
  type PlaceArea,
  placeAreaQuery,
  savePlaceAreaMutation,
} from "@/api/place-areas";
import { AreaSearch } from "@/components/area-search";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** The saved place a group's photos are at. */
interface GroupPlace {
  id: string;
  name: string;
}

/**
 * The area of the place a group's photos are at, from the group's header: a button, filled in when
 * the place has an area, that opens a flyout to find one on OpenStreetMap and save it as the
 * place's area (places/<id>.geo.json), or remove it. Nothing shows for a group with no place.
 */
export function GroupAreaButton({ place }: { place?: GroupPlace }) {
  return place ? <PlaceAreaFlyout place={place} /> : null;
}

function PlaceAreaFlyout({ place }: { place: GroupPlace }) {
  const [open, setOpen] = useState(false);
  const area = useQuery(placeAreaQuery(place.id)).data;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-7", area && "text-sky-600 dark:text-sky-300")}
          title={area ? `${place.name}'s area` : `Add an area for ${place.name}`}
        >
          <Shapes className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-[28rem] flex-col gap-2">
        <AreaEditor place={place} area={area} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

interface AreaEditorProps {
  place: GroupPlace;
  area: PlaceArea | null | undefined;
  onDone: () => void;
}

/** What the flyout shows: the place's area if it has one, and finding one to save. */
function AreaEditor({ place, area, onDone }: AreaEditorProps) {
  const queryClient = useQueryClient();
  const done = {
    onSuccess: () => {
      void queryClient.invalidateQueries(placeAreaQuery(place.id));
      onDone();
    },
  };
  const save = useMutation(savePlaceAreaMutation);
  const remove = useMutation(deletePlaceAreaMutation);
  const pick = ({ osm, shape }: Area) => save.mutate({ id: place.id, area: { osm, shape } }, done);
  return (
    <>
      <p className="text-sm font-medium">Area of {place.name}</p>
      <p className="text-muted-foreground text-xs">
        Saved with the place, so the portfolio's map shades it when the place is picked, and this
        map shows it for every day at the place.
      </p>
      {area && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={remove.isPending}
          onClick={() => remove.mutate(place.id, done)}
        >
          <Trash2 aria-hidden />
          Remove its area
        </Button>
      )}
      <AreaSearch initial={place.name} onPick={pick} />
    </>
  );
}
