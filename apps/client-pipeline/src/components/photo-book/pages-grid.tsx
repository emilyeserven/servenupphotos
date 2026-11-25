import { Layers2Icon } from "lucide-react";
import { type DragEvent, useState } from "react";
import { MoveToControl } from "@/components/photo-book/move-to-control";
import type { PageLook } from "@/components/photo-book/page-actions";
import { InBookBadge } from "@/components/photo-book/page-controls";
import { unitName } from "@/components/photo-book/page-types";
import { UnitSheets } from "@/components/photo-book/unit-sheets";
import { Button } from "@/components/ui/button";
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
  /** Each one's position among all the photo pages, hidden alternates too, by its ID, 1 first. */
  positions: Map<string, number>;
  /** Moves the page or spread with ID id to position among the photo pages, 1 first. */
  onMoveTo: (id: string, position: number) => void;
  /** Makes the pages and spreads with these IDs alternates of each other, in one group. */
  onSetAlternates: (ids: string[]) => void;
}

/** Which pages and spreads are checked in the grid, and checking or unchecking one. */
interface GridChecks {
  checked: Set<string>;
  onCheck: (id: string, on: boolean) => void;
}

/**
 * The Photo Pages grid: every photo page and spread as a small preview, in order, to drag onto
 * another to put it before that one, or onto the box at the end; a spread moves as one. Clicking
 * one opens it in the editing view, and clicking its number moves it to a position typed. Checking two or more and **Set as alternates** puts them in one
 * alternates group.
 */
export function PagesGrid(props: PagesGridProps) {
  const { units, onPlace, onSetAlternates } = props;
  const end = useDropTarget(PHOTO_UNIT_DRAG_TYPE, (id) => onPlace(id, null));
  const [picked, setPicked] = useState<string[]>([]);
  const checked = new Set(picked.filter((id) => units.some((unit) => unit.id === id)));
  const onCheck = (id: string, on: boolean) =>
    setPicked(on ? [...checked, id] : [...checked].filter((other) => other !== id));
  return (
    <div className="flex flex-col gap-3">
      <CheckedBar
        count={checked.size}
        onSet={() => {
          onSetAlternates([...checked]);
          setPicked([]);
        }}
        onClear={() => setPicked([])}
      />
      <ol aria-label="Photo pages" className="flex flex-wrap items-start gap-4">
        {units.map((unit) => (
          <GridUnit key={unit.id} unit={unit} checked={checked} onCheck={onCheck} {...props} />
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
    </div>
  );
}

/** Above the grid: how many are checked, **Set as alternates** for two or more, and Clear. */
function CheckedBar(props: { count: number; onSet: () => void; onClear: () => void }) {
  const { count, onSet, onClear } = props;
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">
        {count === 0
          ? "Check two or more pages or spreads to set them as alternates of each other."
          : `${count} checked`}
      </span>
      {count > 0 && (
        <>
          <Button size="xs" variant="secondary" disabled={count < 2} onClick={onSet}>
            <Layers2Icon />
            Set as alternates
          </Button>
          <Button size="xs" variant="ghost" onClick={onClear}>
            Clear
          </Button>
        </>
      )}
    </div>
  );
}

/** Starts dragging the photo page or spread with ID id in the grid. */
function dragPhotoUnit(event: DragEvent, id: string) {
  event.dataTransfer.setData(PHOTO_UNIT_DRAG_TYPE, id);
  event.dataTransfer.effectAllowed = "move";
}

/** One page or spread in the grid: its preview, its checkbox, its number (to move it), name and In book. */
function GridUnit(props: PagesGridProps & GridChecks & { unit: BookUnit }) {
  const { unit, inBook, look, onPlace, onOpen, checked, onCheck, positions, onMoveTo } = props;
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
        <input
          type="checkbox"
          className="accent-primary size-3.5 cursor-pointer"
          checked={checked.has(unit.id)}
          onChange={(event) => onCheck(unit.id, event.target.checked)}
          aria-label={`Check ${name}`}
        />
        <MoveToControl
          name={name}
          position={positions.get(unit.id) ?? 0}
          total={positions.size}
          onMoveTo={(to) => onMoveTo(unit.id, to)}
        >
          <button
            type="button"
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded px-0.5 tabular-nums"
            aria-label={`Move ${name} to a position`}
            title="Move to…"
          >
            {positions.get(unit.id)}
          </button>
        </MoveToControl>
        <span className="min-w-0 flex-1 truncate" title={name}>
          {name}
        </span>
        {inBook.has(unit.id) && <InBookBadge />}
      </div>
    </li>
  );
}
