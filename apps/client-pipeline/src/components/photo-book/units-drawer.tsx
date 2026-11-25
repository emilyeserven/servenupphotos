import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import type { PageLook } from "@/components/photo-book/page-actions";
import { InBookBadge } from "@/components/photo-book/page-controls";
import { unitName } from "@/components/photo-book/page-types";
import { BOOK_UNIT_DRAG_TYPE, dragUnit } from "@/components/photo-book/unit-drag";
import { UnitSheets } from "@/components/photo-book/unit-sheets";
import { TagSelect } from "@/components/photo-book/unit-tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDropTarget } from "@/hooks/use-drop-target";
import { isOtherPage } from "@/lib/photo-book";
import { type BookUnit, unitsTagged } from "@/lib/photo-book-order";
import { cn } from "@/lib/utils";
import { count } from "@portfolio/lib/words";

interface UnitsDrawerProps {
  /** Every page and spread made for the book. */
  units: BookUnit[];
  /** The IDs of the ones in the book. */
  inBook: Set<string>;
  look: PageLook;
  onAdd: (id: string) => void;
  onTakeOut: (id: string) => void;
  onAddOther: (name: string) => void;
  /** Removes the other page with ID id. */
  onRemoveOther: (id: string) => void;
  open: boolean;
  onOpen: (open: boolean) => void;
  /** Every tag in the book, to filter by. */
  tags: string[];
}

/**
 * The drawer along the bottom of the Book tab: every page and spread made for the book, photo
 * pages first and then the other pages, each to drag into Used page spreads or add at the end, and
 * a form that makes an other page. Dropping a page or spread from Used page spreads here takes it
 * out of the book. Closed, it's one line.
 */
export function UnitsDrawer(props: UnitsDrawerProps) {
  const { units, open, onTakeOut, tags } = props;
  const drop = useDropTarget(BOOK_UNIT_DRAG_TYPE, (id) => onTakeOut(id));
  const [picked, setPicked] = useState<string | null>(null);
  const { filter, shown } = unitsTagged(units, tags, picked);
  return (
    <section
      aria-label="All pages and spreads"
      {...drop.handlers}
      className={cn(
        "bg-background sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 rounded-t-xl border border-b-0 px-3 pt-2 pb-3 shadow-[0_-4px_16px_rgb(0_0_0/0.08)]",
        drop.over && "ring-primary ring-2",
      )}
    >
      <DrawerHeader {...props} filter={filter} onFilter={setPicked} />
      {open && (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {shown.map((unit) => (
            <DrawerUnit key={unit.id} unit={unit} {...props} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The drawer's name, how many pages and spreads it has, and, open, the tag dropdown beside them and
 * the other page form.
 */
function DrawerHeader(
  props: UnitsDrawerProps & { filter: string | null; onFilter: (tag: string | null) => void },
) {
  const { units, inBook, open, onOpen, onAddOther, tags, filter, onFilter } = props;
  const Icon = open ? ChevronDownIcon : ChevronUpIcon;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium"
      >
        <Icon className="size-4" />
        All pages and spreads
        <span className="text-muted-foreground font-normal">
          {count(units.length, "page or spread", "pages and spreads")} · {inBook.size} in the book
        </span>
      </button>
      {open && <TagSelect tags={tags} value={filter} onChange={onFilter} />}
      {open && <OtherPageForm onAdd={onAddOther} />}
    </div>
  );
}

/**
 * One page or spread in the drawer, its height fixed and its width from its shape. Its tags aren't
 * shown, to keep it short; they're set on Photo Pages.
 */
function DrawerUnit(props: UnitsDrawerProps & { unit: BookUnit }) {
  const { unit, inBook, look } = props;
  const name = unitName(unit);
  return (
    <li
      draggable
      onDragStart={(event) => dragUnit(event, unit.id)}
      className={cn(
        "flex shrink-0 cursor-grab flex-col gap-1",
        inBook.has(unit.id) && "opacity-75",
      )}
      style={{ width: `calc(5.5rem * ${look.aspect * unit.pages.length})` }}
    >
      <UnitSheets pages={unit.pages} look={look} className="gap-px" />
      <div className="flex min-h-6 items-center gap-1 text-xs">
        <span className="min-w-0 flex-1 truncate" title={name}>
          {name}
        </span>
        <UnitActions {...props} name={name} />
      </div>
    </li>
  );
}

/** **+**, which adds the page or spread at the end of the book, or In book; and an other page's bin. */
function UnitActions(props: UnitsDrawerProps & { unit: BookUnit; name: string }) {
  const { unit, name, inBook, onAdd, onRemoveOther } = props;
  return (
    <>
      {inBook.has(unit.id) ? (
        <InBookBadge />
      ) : (
        <Button
          size="icon-xs"
          variant="outline"
          aria-label={`Add ${name} to the end of the book`}
          title="Add to the book"
          onClick={() => onAdd(unit.id)}
        >
          <PlusIcon />
        </Button>
      )}
      {unit.pages.some(isOtherPage) && (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Remove ${name}`}
          title="Remove page"
          onClick={() => onRemoveOther(unit.id)}
        >
          <Trash2Icon />
        </Button>
      )}
    </>
  );
}

/**
 * Makes an other page: a page the publisher requires, a bio page, or anything else, shown by its
 * name for now, and added at the end of the book.
 */
function OtherPageForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="ml-auto flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim());
        setName("");
      }}
    >
      <Input
        aria-label="Other page name"
        value={name}
        placeholder="Bio, Publisher page…"
        onChange={(event) => setName(event.target.value)}
        className="h-8 w-48"
      />
      <Button type="submit" size="sm" variant="outline" disabled={!name.trim()}>
        <PlusIcon />
        Add other page
      </Button>
    </form>
  );
}
