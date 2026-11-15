import type { ReactNode } from "react";
import { useDragOrder } from "@/hooks/use-drag-order";
import { useDropTarget } from "@/hooks/use-drop-target";
import { cn } from "@/lib/utils";

interface TileDropListProps<T> {
  /** The items, in order, one tile each. */
  items: T[];
  /** Each item's key, which stays the same as it moves. */
  keyOf: (item: T) => string | number;
  /** Draws an item's tile, at its place in the list. */
  tile: (item: T, place: number) => ReactNode;
  /** Moves the item at from to to. */
  onMove: (from: number, to: number) => void;
  /** The drag type a photo dragged here from the drawer carries its file's path as. */
  dragType: string;
  /** Adds the photo file at path at the end. */
  onAdd: (path: string) => void;
  /** What it says while it has no tiles. */
  empty: ReactNode;
}

/**
 * A grid of tiles in order, such as the bio's photos or a Photo Set's, to drag into order. It's
 * ringed while a photo from the drawer is dragged over it, which adds it at the end when dropped.
 */
export function TileDropList<T>(props: TileDropListProps<T>) {
  const { items, keyOf, tile, onMove, dragType, onAdd, empty } = props;
  const drag = useDragOrder(onMove);
  const drop = useDropTarget(dragType, onAdd);
  return (
    <div
      {...drop.handlers}
      className={cn("rounded-lg", drop.over && "ring-ring ring-2 ring-offset-2")}
    >
      {items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          {empty}
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
          {items.map((item, place) => (
            <li
              key={keyOf(item)}
              draggable
              onDragStart={(event) => drag.start(place, event)}
              onDragEnter={() => drag.enter(place)}
              onDragOver={(event) => event.preventDefault()}
              onDragEnd={drag.end}
              className={cn(
                "bg-card flex cursor-grab flex-col gap-1.5 rounded-lg border p-1.5 active:cursor-grabbing",
                drag.dragging === place && "border-primary opacity-50",
              )}
            >
              {tile(item, place)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
