import { ChevronDown, Palette } from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { Swatch } from "@portfolio/components/graph-builder/graph-parts";
import type { GraphSeries } from "@portfolio/lib/graph-data";
import { cn } from "@portfolio/lib/utils";

/** A series or slice in the graph's key. */
type KeyItem = Pick<GraphSeries, "label" | "color">;

/** Where the key's button goes: the end of the row with the y axis's name, once it's drawn. */
const KeySlot = createContext<HTMLElement | null>(null);

/**
 * The row over the graph, with `start` (the y axis's name) on the left and room for the key's
 * button on the right, so folded the key takes no space from the graph; then the graph. The row
 * hides while it has nothing in it, such as a photo dot graph's with no split.
 */
export function KeyRow({ start, children }: { start: ReactNode; children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <div className="hidden min-h-7 flex-wrap items-center justify-between gap-2 has-[>:not(:empty)]:flex">
        {start}
        <div ref={setSlot} className="ml-auto" />
      </div>
      <KeySlot value={slot}>{children}</KeySlot>
    </>
  );
}

/**
 * A graph with its key: a **Key** button at the end of the y axis's row, so folded it covers
 * nothing, and open at first, its list floating under the button over the graph's top right
 * corner, apart from the y axis. Without items, just the graph.
 */
export function WithKey({ items, children }: { items: KeyItem[]; children: ReactNode }) {
  const slot = useContext(KeySlot);
  const panel = items.length > 0 && slot !== null;
  return (
    <>
      {panel && createPortal(<KeyPanel items={items} />, slot)}
      {children}
    </>
  );
}

/** The key's button, which opens and closes it, and while it's open each item with its color floating under it. */
function KeyPanel({ items }: { items: KeyItem[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="relative z-10 w-max max-w-44 rounded-md border bg-card/95 text-xs shadow-sm backdrop-blur-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Palette className="size-3.5 text-muted-foreground" aria-hidden />
        Key
        <ChevronDown
          aria-hidden
          className={cn("ml-auto size-3.5 opacity-60 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="absolute top-full -right-px w-max max-w-48 min-w-[calc(100%+2px)] rounded-md rounded-tr-none border bg-card/95 shadow-sm backdrop-blur-sm">
          <KeyList items={items} />
        </div>
      )}
    </div>
  );
}

/** Each item with its color, scrolling when there are many. */
function KeyList({ items }: { items: KeyItem[] }) {
  return (
    <ul
      aria-label="Key"
      className="flex max-h-48 flex-col gap-1 overflow-y-auto px-2 py-1.5 text-muted-foreground"
    >
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <Swatch color={item.color} />
          <span className="truncate">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
