import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { LayoutGlyph } from "@/components/photo-book/layout-glyph";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LAYOUTS, type PageLayout } from "@/lib/photo-book";

/** **Add page**, which asks for the new page's layout and adds it at the end of the book. */
export function AddPageButton({ onAdd }: { onAdd: (layout: PageLayout) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <PlusIcon />
          Add page
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs">
          Pick the new page&apos;s layout
        </p>
        <ul className="flex flex-col gap-1">
          {LAYOUTS.map((layout) => (
            <li key={layout.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(layout.id);
                  setOpen(false);
                }}
                className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-md p-2 text-left outline-none focus-visible:ring-2"
              >
                <LayoutGlyph
                  layout={layout.id}
                  className="text-muted-foreground h-9 w-12 shrink-0"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{layout.label}</span>
                  <span className="text-muted-foreground text-xs">{layout.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
