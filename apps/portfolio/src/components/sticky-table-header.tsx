import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

/**
 * Whether the table's own header row has scrolled above the top of the window while some of the
 * table's rows are still showing, which is when the copy of the header should show.
 */
function headerScrolledPast(table: HTMLTableElement): boolean {
  const head = table.tHead;
  if (!head) return false;
  const { top, height } = head.getBoundingClientRect();
  return top < 0 && table.getBoundingClientRect().bottom > height;
}

/** Whether the header copy shows, checked again on every scroll and resize of the window. */
function useScrolledPast(tableRef: RefObject<HTMLTableElement | null>): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const update = () => {
      if (tableRef.current) setPast(headerScrolledPast(tableRef.current));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [tableRef]);
  return past;
}

/** Gives the copy the table's width and each of its columns the width of the table's own header cells. */
function copyWidths(table: HTMLTableElement, copy: HTMLTableElement) {
  const widths = [...(table.tHead?.rows[0]?.cells ?? [])].map((cell) => cell.offsetWidth);
  copy.style.width = `${table.offsetWidth}px`;
  [...copy.querySelectorAll("col")].forEach((col, i) => {
    col.style.width = `${widths[i] ?? 0}px`;
  });
}

/** Keeps the copy's column widths matching the table's, whenever the table changes size. */
function useMatchedWidths(
  tableRef: RefObject<HTMLTableElement | null>,
  copyRef: RefObject<HTMLTableElement | null>,
  shown: boolean,
) {
  useEffect(() => {
    const table = tableRef.current;
    const copy = copyRef.current;
    if (!shown || !table || !copy) return;
    const observer = new ResizeObserver(() => copyWidths(table, copy));
    observer.observe(table);
    return () => observer.disconnect();
  }, [tableRef, copyRef, shown]);
}

/** Takes the copy's buttons out of the keyboard's tab order, since the table's own header has the same ones. */
function useUnfocusable(barRef: RefObject<HTMLElement | null>) {
  // Runs after every render, since the copy's buttons are new whenever it shows again.
  useEffect(() => {
    barRef.current?.querySelectorAll("button").forEach((button) => {
      button.tabIndex = -1;
    });
  });
}

/** Keeps the copy scrolled sideways as far as the table, which scrolls sideways on narrow screens. */
function useMatchedScroll(
  scrollerRef: RefObject<HTMLElement | null>,
  barRef: RefObject<HTMLElement | null>,
  shown: boolean,
) {
  useEffect(() => {
    const scroller = scrollerRef.current;
    const bar = barRef.current;
    if (!shown || !scroller || !bar) return;
    const update = () => {
      bar.scrollLeft = scroller.scrollLeft;
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, [scrollerRef, barRef, shown]);
}

/**
 * A copy of a table's header row that sticks to the top of the window once the table's own header
 * has scrolled past, until the table's last row goes by. The table sits in a box that scrolls
 * sideways, which keeps CSS `position: sticky` on its own header from working, so the copy follows
 * its columns' widths and sideways scroll instead. It's hidden from screen readers and from the
 * keyboard, which use the table's own header, but its buttons still work with a click or a tap.
 * Put it in the same box as the table's scroller, just before it.
 */
export function StickyTableHeader({
  tableRef,
  scrollerRef,
  columns,
  children,
}: {
  tableRef: RefObject<HTMLTableElement | null>;
  scrollerRef: RefObject<HTMLElement | null>;
  /** How many columns the table has, so the copy has a width for each. */
  columns: number;
  /** The copy's header row or rows, the same as the table's `<thead>` holds. */
  children: ReactNode;
}) {
  const shown = useScrolledPast(tableRef);
  const barRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLTableElement>(null);
  useMatchedWidths(tableRef, copyRef, shown);
  useMatchedScroll(scrollerRef, barRef, shown);
  useUnfocusable(barRef);
  if (!shown) return null;
  return (
    // Takes up no room, so the table doesn't move when the copy shows.
    <div className="sticky top-0 z-10 h-0">
      <div
        ref={barRef}
        aria-hidden
        className="overflow-hidden rounded-t-md border bg-background shadow-sm"
      >
        <table ref={copyRef} className="table-fixed text-sm">
          <colgroup>
            {Array.from({ length: columns }, (_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <thead className="bg-muted/50 text-left text-muted-foreground">{children}</thead>
        </table>
      </div>
    </div>
  );
}
