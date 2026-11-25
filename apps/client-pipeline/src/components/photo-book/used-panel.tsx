import { PanelRightCloseIcon, PanelRightOpenIcon, XIcon } from "lucide-react";
import { MoveArrows } from "@/components/move-arrows";
import type { PageLook } from "@/components/photo-book/page-actions";
import { unitName } from "@/components/photo-book/page-types";
import { BOOK_UNIT_DRAG_TYPE, dragUnit } from "@/components/photo-book/unit-drag";
import { UnitSheets } from "@/components/photo-book/unit-sheets";
import { SectionTitle } from "@/components/section-title";
import { Button } from "@/components/ui/button";
import { useDropTarget } from "@/hooks/use-drop-target";
import type { BookUnit } from "@/lib/photo-book-order";
import { cn } from "@/lib/utils";

interface UsedPanelProps {
  /** The pages and spreads in the book, in its order. */
  units: BookUnit[];
  /** The IDs of the units the preview shows. */
  shown: string[];
  look: PageLook;
  /** Each page's number in the book, by its ID. */
  numbers: Map<string, number>;
  onShow: (id: string) => void;
  /** Puts the unit with ID id in the book just before the one with ID before, or at its end. */
  onPlace: (id: string, before: string | null) => void;
  onMove: (from: number, to: number) => void;
  onTakeOut: (id: string) => void;
  collapsed: boolean;
  onCollapsed: (collapsed: boolean) => void;
}

/**
 * Used page spreads: the book's pages and spreads in order, top to bottom, each to drag to
 * another place, move with arrows, take out, or click to show in the preview. Drop a page or
 * spread from the drawer on one to put it before it, or below them to put it at the end.
 * Collapsed, it's a thin rail.
 */
export function UsedPanel(props: UsedPanelProps) {
  const { units, collapsed, onCollapsed, onPlace } = props;
  const end = useDropTarget(BOOK_UNIT_DRAG_TYPE, (id) => onPlace(id, null));
  if (collapsed) {
    return (
      <aside
        aria-label="Used page spreads"
        className="flex w-10 shrink-0 flex-col items-center gap-2 border-l pt-1"
      >
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Show Used page spreads"
          onClick={() => onCollapsed(false)}
        >
          <PanelRightOpenIcon />
        </Button>
        <span className="text-muted-foreground text-xs [writing-mode:vertical-rl]">
          Used page spreads · {units.length}
        </span>
      </aside>
    );
  }
  return (
    <aside aria-label="Used page spreads" className="flex w-full shrink-0 flex-col gap-2 lg:w-64">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle as="h2">Used page spreads</SectionTitle>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Collapse Used page spreads"
          onClick={() => onCollapsed(true)}
        >
          <PanelRightCloseIcon />
        </Button>
      </div>
      <ol className="flex flex-col gap-2">
        {units.map((unit, place) => (
          <UsedUnit key={unit.id} unit={unit} place={place} {...props} />
        ))}
      </ol>
      <div
        {...end.handlers}
        className={cn(
          "text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs",
          end.over && "border-primary bg-primary/5",
        )}
      >
        Drop a page or spread here to put it at the end
      </div>
    </aside>
  );
}

/** "Pages 3–4", or "Page 5", by the unit's pages' numbers in the book. */
function numbersText(unit: BookUnit, numbers: Map<string, number>): string {
  const ns = unit.pages.flatMap((page) => numbers.get(page.id) ?? []);
  return ns.length > 1 ? `Pages ${ns[0]}–${ns.at(-1)}` : `Page ${ns[0]}`;
}

/** One page or spread in Used page spreads. */
function UsedUnit(props: UsedPanelProps & { unit: BookUnit; place: number }) {
  const { unit, place, units, shown, look, numbers, onShow, onPlace, onMove, onTakeOut } = props;
  const drop = useDropTarget(BOOK_UNIT_DRAG_TYPE, (id) => {
    if (id !== unit.id) onPlace(id, unit.id);
  });
  const name = unitName(unit);
  return (
    <li
      {...drop.handlers}
      draggable
      onDragStart={(event) => dragUnit(event, unit.id)}
      className={cn(
        "bg-card flex cursor-grab flex-col gap-1 rounded-md border p-1.5",
        shown.includes(unit.id) && "ring-primary ring-2",
        drop.over && "border-t-primary border-t-4",
      )}
    >
      <button
        type="button"
        onClick={() => onShow(unit.id)}
        aria-label={`Show ${name}`}
        className="block"
      >
        <UnitSheets pages={unit.pages} look={look} />
      </button>
      <div className="flex items-center gap-0.5 text-xs">
        <span className="min-w-0 flex-1 truncate" title={name}>
          <span className="text-muted-foreground">{numbersText(unit, numbers)} · </span>
          {name}
        </span>
        <MoveArrows name={name} place={place} last={place === units.length - 1} onMove={onMove} />
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Take ${name} out of the book`}
          title="Take out"
          onClick={() => onTakeOut(unit.id)}
        >
          <XIcon />
        </Button>
      </div>
    </li>
  );
}
