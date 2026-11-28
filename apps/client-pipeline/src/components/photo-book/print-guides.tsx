import type { PageSide } from "@/lib/photo-book";
import type { PageGuides } from "@/lib/photo-book-guides";
import { printGuides } from "@/stores/photo-book-guides";

/**
 * **Show bleed and safe boundary**, on the Book and Layouts tabs: draws Blurb's bleed and safe
 * boundary over every page, only as a guide on the screen.
 */
export function PrintGuidesToggle() {
  const on = printGuides.use();
  return (
    <label
      className="flex items-center gap-2 text-sm"
      title="Shades the bleed Blurb trims off each page's top, bottom and outside edge, and dashes Blurb's safe boundary (0.25 in inside the trim, 0.5 in at the binding). Only on the screen: never in a PDF."
    >
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={on}
        onChange={(event) => printGuides.set(event.target.checked)}
      />
      Show bleed and safe boundary
    </label>
  );
}

/**
 * Blurb's guides over a page on side of the open book: the bleed Blurb trims shaded red along its
 * top, bottom and outside edge (the left edge of a left page, the right of a right page), and the
 * safe boundary dashed, further in from the binding edge. Never printed; text and photos aren't
 * moved for them.
 */
export function PageGuidesOverlay({ guides, side }: { guides: PageGuides; side: PageSide }) {
  const outside = side === "left" ? "left" : "right";
  const binding = side === "left" ? "right" : "left";
  const band = "absolute bg-red-500/55";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 in-data-[print]:hidden">
      <div className={`${band} inset-x-0 top-0`} style={{ height: `${guides.top}%` }} />
      <div className={`${band} inset-x-0 bottom-0`} style={{ height: `${guides.top}%` }} />
      <div className={`${band} inset-y-0`} style={{ [outside]: 0, width: `${guides.outside}%` }} />
      <div
        className="absolute border border-dashed border-cyan-400"
        style={{
          top: `${guides.safeTop}%`,
          bottom: `${guides.safeTop}%`,
          [outside]: `${guides.safeOutside}%`,
          [binding]: `${guides.safeBinding}%`,
        }}
      />
    </div>
  );
}
