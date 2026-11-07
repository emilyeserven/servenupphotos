import { ChevronDown, Palette } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Swatch } from "@portfolio/components/graph-builder/graph-parts";
import type { GraphSeries } from "@portfolio/lib/graph-data";
import { cn } from "@portfolio/lib/utils";

/** A series or slice in the graph's key. */
type KeyItem = Pick<GraphSeries, "label" | "color">;

/**
 * A graph with its key floating over its top right corner, apart from the y axis: open at first,
 * and folded up to a small **Key** button by clicking its heading. Without items, just the graph.
 */
export function WithKey({ items, children }: { items: KeyItem[]; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      {items.length > 0 && <KeyPanel items={items} />}
    </div>
  );
}

/** The floating key: its heading, which opens and closes it, over each item with its color. */
function KeyPanel({ items }: { items: KeyItem[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="absolute top-0 right-0 z-10 max-w-44 rounded-md border bg-card/95 text-xs shadow-sm backdrop-blur-sm">
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
      {open && <KeyList items={items} />}
    </div>
  );
}

/** Each item with its color, scrolling when there are many. */
function KeyList({ items }: { items: KeyItem[] }) {
  return (
    <ul
      aria-label="Key"
      className="flex max-h-48 flex-col gap-1 overflow-y-auto border-t px-2 py-1.5 text-muted-foreground"
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
