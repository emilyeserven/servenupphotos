import type { DragEvent } from "react";
import type { PageLook } from "@/components/photo-book/page-actions";
import { InBookBadge } from "@/components/photo-book/page-controls";
import { unitName } from "@/components/photo-book/page-types";
import { UnitSheets } from "@/components/photo-book/unit-sheets";
import { useDropTarget } from "@/hooks/use-drop-target";
import type { BookUnit } from "@/lib/photo-book-order";
import { cn } from "@/lib/utils";

/** A photo page or spread dragged in the Photo Pages grid, as its unit's ID. */
const PHOTO_UNIT_DRAG_TYPE = "application/x-photo-book-photo-unit";

interface PagesGridProps {
  /** The photo pages and spreads, in their order. */
  units: BookUnit[];
  /** The IDs of the ones in the book. */
  inBook: Set<string>;
  look: PageLook;
  /** Puts the page or spread with ID id before the one with ID before, or at the end with null. */
  onPlace: (id: string, before: string | null) => void;
  /** Opens the page or spread with ID id in the editing view. */
  onOpen: (id: string) => void;
}

/**
 * The Photo Pages grid: every photo page and spread as a small preview, in order, to drag onto
 * another to put it before that one, or onto the box at the end; a spread moves as one. Clicking
 * one opens it in the editing view.
 */
export function PagesGrid(props: PagesGridProps) {
  const { units, onPlace } = props;
  const end = useDropTarget(PHOTO_UNIT_DRAG_TYPE, (id) => onPlace(id, null));
  return (
    <ol aria-label="Photo pages" className="flex flex-wrap items-start gap-4">
      {units.map((unit, place) => (
        <GridUnit key={unit.id} unit={unit} place={place} {...props} />
      ))}
      <li
        {...end.handlers}
        className={cn(
          "text-muted-foreground flex h-32 w-40 items-center justify-center rounded-md border border-dashed p-3 text-center text-xs",
          end.over && "border-primary bg-primary/5",
        )}
      >
        Drop a page or spread here to put it at the end
      </li>
    </ol>
  );
}

/** Starts dragging the photo page or spread with ID id in the grid. */
function dragPhotoUnit(event: DragEvent, id: string) {
  event.dataTransfer.setData(PHOTO_UNIT_DRAG_TYPE, id);
  event.dataTransfer.effectAllowed = "move";
}

/** One page or spread in the grid: its preview, its place and name, and In book. */
function GridUnit(props: PagesGridProps & { unit: BookUnit; place: number }) {
  const { unit, place, inBook, look, onPlace, onOpen } = props;
  const drop = useDropTarget(PHOTO_UNIT_DRAG_TYPE, (id) => onPlace(id, unit.id));
  const name = unitName(unit);
  return (
    <li
      {...drop.handlers}
      draggable
      onDragStart={(event) => dragPhotoUnit(event, unit.id)}
      className={cn(
        "flex shrink-0 cursor-grab flex-col gap-1 rounded-md border-l-4 border-transparent pl-1 active:cursor-grabbing",
        drop.over && "border-primary",
      )}
      style={{ width: `calc(8rem * ${look.aspect * unit.pages.length})` }}
    >
      <button type="button" onClick={() => onOpen(unit.id)} aria-label={`Edit ${name}`}>
        <UnitSheets pages={unit.pages} look={look} className="gap-px" />
      </button>
      <div className="flex min-h-6 items-center gap-1 text-xs">
        <span className="text-muted-foreground tabular-nums">{place + 1}</span>
        <span className="min-w-0 flex-1 truncate" title={name}>
          {name}
        </span>
        {inBook.has(unit.id) && <InBookBadge />}
      </div>
    </li>
  );
}
