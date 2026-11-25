import { PlusIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { LayoutGlyph } from "@/components/photo-book/layout-glyph";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PageLayout } from "@/lib/photo-book";
import type { LayoutChoice } from "@/lib/photo-book-layouts";

/**
 * **Add page**, which asks for the new page's layout, built in or made on the Layouts tab, and adds
 * it after the other photo pages.
 */
export function AddPageButton(props: {
  layouts: LayoutChoice[];
  onAdd: (layout: PageLayout) => void;
  /**
   * Leaves focus where it is when the flyout closes, rather than on the button, so scrolling to the
   * new page isn't undone by the page scrolling back to the button.
   */
  keepScroll?: boolean;
  /** The button that opens the flyout, a Button; **Add page** when left out. */
  trigger?: ReactNode;
}) {
  const { layouts, onAdd, keepScroll, trigger } = props;
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <PlusIcon />
            Add page
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-2"
        onCloseAutoFocus={keepScroll ? (event) => event.preventDefault() : undefined}
      >
        <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs">
          Pick the new page&apos;s layout
        </p>
        <ul className="flex flex-col gap-1">
          {layouts.map((layout) => (
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
                  look={layout.look}
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
