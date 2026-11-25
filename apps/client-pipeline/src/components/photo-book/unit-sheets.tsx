import { BookPage } from "@/components/photo-book/book-page";
import { NO_ACTIONS, type PageLook } from "@/components/photo-book/page-actions";
import type { BookPage as Page } from "@/lib/photo-book";
import { isInsideCover, isPlaceholder } from "@/lib/photo-book-order";
import { cn } from "@/lib/utils";

/** No photo is marked as on another page in a preview. */
const NOT_REPEATED = new Map<string, number[]>();

/**
 * Pages side by side as the book shows them, left first, only to look at: a page, a spread, or two
 * facing pages. Fills its width, keeping the pages' shape.
 */
export function UnitSheets(props: { pages: Page[]; look: PageLook; className?: string }) {
  const { pages, look, className } = props;
  return (
    <div
      inert
      data-preview
      className={cn("grid", className)}
      style={{ gridTemplateColumns: `repeat(${pages.length}, minmax(0, 1fr))` }}
    >
      {pages.map((page, i) =>
        isPlaceholder(page) ? (
          <PlaceholderSheet key={page.id} page={page} aspect={look.aspect} />
        ) : (
          <BookPage
            key={page.id}
            page={page}
            index={-1}
            number={null}
            repeated={NOT_REPEATED}
            {...look}
            side={pages.length > 1 ? (i === 0 ? "left" : "right") : undefined}
            actions={NO_ACTIONS}
          />
        ),
      )}
    </div>
  );
}

/** The width over the height of pages side by side. */
export function sheetsAspect(pages: Page[], look: PageLook): number {
  return look.aspect * Math.max(1, pages.length);
}

/**
 * A page the Book tab adds, not one made for the book: a blank page, striped and dashed so it
 * reads as a placeholder, or an inside cover, plain grey.
 */
function PlaceholderSheet({ page, aspect }: { page: Page; aspect: number }) {
  const cover = isInsideCover(page);
  return (
    <div
      style={{ aspectRatio: aspect }}
      className={cn(
        "text-muted-foreground flex items-center justify-center p-2 text-center text-[10px] sm:text-xs",
        cover
          ? "bg-muted/60"
          : "border-muted-foreground/50 border-2 border-dashed bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgb(127_127_127/0.12)_10px_20px)]",
      )}
    >
      {cover ? page.name : `${page.name} · placeholder`}
    </div>
  );
}
