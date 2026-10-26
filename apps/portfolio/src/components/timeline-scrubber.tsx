import { type KeyboardEvent, type PointerEvent, useEffect, useState } from "react";
import {
  markAt,
  measureMonths,
  type MonthLayout,
  neighbourMark,
  type ScrubberMark,
  scrollFor,
  scrollFraction,
  yearLabels,
} from "@/lib/timeline-scrubber";
import { useSize } from "@/lib/use-size";
import { cn } from "@/lib/utils";

/**
 * A scrubber down the right edge of the window, shown once the chart above the photos has scrolled
 * out of view, like the one in Google Photos. Its ticks are the months in the list and its labels
 * the years; dragging along it, or clicking it, scrolls the list there, and a bubble names the
 * month under the pointer.
 */
export function TimelineScrubber({
  list,
  chart,
}: {
  /** The list of months, whose sections carry their heading in `data-month`. */
  list: HTMLElement | null;
  /** The chart above the list; the scrubber shows once it's scrolled above the window. */
  chart: HTMLElement | null;
}) {
  const layout = useMonthLayout(list);
  const fraction = useScrollFraction(layout);
  const shown = useScrolledPast(chart);
  if (!layout || layout.marks.length < 2) return null;
  return <ScrubberTrack layout={layout} fraction={fraction} shown={shown} />;
}

/** The scrubber itself, faded out while the chart is still in view. */
function ScrubberTrack({
  layout,
  fraction,
  shown,
}: {
  layout: MonthLayout;
  fraction: number;
  shown: boolean;
}) {
  const [trackRef, { height }] = useSize();
  const { pointer, handlers } = useScrub(layout);
  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Scroll through the months"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuetext={markAt(layout.marks, fraction)?.month}
      onKeyDown={(event) => stepMonth(event, layout, fraction)}
      {...handlers}
      {...visibility(shown)}
    >
      <ScrubberTicks marks={layout.marks} trackHeight={height} />
      <ScrubberThumb at={fraction} />
      <ScrubberBubble at={pointer} marks={layout.marks} />
    </div>
  );
}

/** The track's place on the page, and whether it can be seen, focused and used. */
function visibility(shown: boolean) {
  return {
    tabIndex: shown ? 0 : -1,
    "aria-hidden": !shown,
    className: cn(
      "fixed top-20 right-0 bottom-6 z-30 w-12 cursor-ns-resize touch-none outline-none select-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring sm:w-16",
      shown ? "opacity-100" : "pointer-events-none opacity-0",
    ),
  };
}

/**
 * Where the pointer is over the track, from 0 to 1 or `null` when it's elsewhere, and the
 * handlers that scroll the list while it's pressed and dragged.
 */
function useScrub(layout: MonthLayout) {
  const [pointer, setPointer] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Shows the month under the pointer, and scrolls there while it's pressed. */
  function follow(event: PointerEvent<HTMLDivElement>, pressed: boolean) {
    const at = pointerAt(event);
    setPointer(at);
    if (pressed) window.scrollTo({ top: scrollFor(layout, at), behavior: "instant" });
  }

  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      follow(event, true);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => follow(event, dragging),
    onPointerUp: () => setDragging(false),
    onPointerLeave: () => setPointer(null),
  };
  return { pointer, handlers };
}

/** How far down the track the pointer is, from 0 to 1. */
function pointerAt(event: PointerEvent<HTMLDivElement>): number {
  const box = event.currentTarget.getBoundingClientRect();
  return (event.clientY - box.top) / Math.max(1, box.height);
}

/** Moves to the next or previous month with the arrow keys. */
function stepMonth(event: KeyboardEvent, layout: MonthLayout, fraction: number) {
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key] as 1 | -1 | undefined;
  if (!step) return;
  event.preventDefault();
  // A little past the month's start, so the next press moves on from it.
  const next = neighbourMark(layout.marks, fraction + 0.0001, step);
  if (next) window.scrollTo({ top: scrollFor(layout, next.at) + 1, behavior: "instant" });
}

/** A short tick for each month, and each year's label at its first month. */
function ScrubberTicks({ marks, trackHeight }: { marks: ScrubberMark[]; trackHeight: number }) {
  return (
    <>
      {marks.map((mark) => (
        <span
          key={mark.month}
          className="absolute right-2 h-px w-1.5 bg-muted-foreground/50"
          style={{ top: `${mark.at * 100}%` }}
        />
      ))}
      {yearLabels(marks, trackHeight).map((label) => (
        <span
          key={label.year}
          className="absolute right-4 -translate-y-1/2 rounded-sm bg-background/80 px-1 text-[11px] font-medium text-muted-foreground tabular-nums"
          style={{ top: `${label.at * 100}%` }}
        >
          {label.year}
        </span>
      ))}
    </>
  );
}

/** The line across the track at the month now at the top of the window. */
function ScrubberThumb({ at }: { at: number }) {
  return (
    <span
      className="absolute right-1 h-0.5 w-4 -translate-y-1/2 rounded-full bg-primary"
      style={{ top: `${at * 100}%` }}
    />
  );
}

/** The bubble beside the track naming the month under the pointer, while there is one. */
function ScrubberBubble({ at, marks }: { at: number | null; marks: ScrubberMark[] }) {
  if (at === null) return null;
  return (
    <span
      className="absolute right-full mr-1 -translate-y-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background shadow-md"
      style={{ top: `${Math.min(1, Math.max(0, at)) * 100}%` }}
    >
      {markAt(marks, at)?.month}
    </span>
  );
}

/** Where the list's months are, measured again whenever the list or the page changes size. */
function useMonthLayout(list: HTMLElement | null): MonthLayout | null {
  const [layout, setLayout] = useState<MonthLayout | null>(null);
  useEffect(() => {
    if (!list) return;
    // The page too, as the filters opening above move the list down without resizing it.
    const observer = new ResizeObserver(() => setLayout(measureMonths(list)));
    observer.observe(list);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [list]);
  return layout;
}

/** How far down the list the top of the window is, kept up to date as the page scrolls. */
function useScrollFraction(layout: MonthLayout | null): number {
  const [scrollY, setScrollY] = useState(() => window.scrollY);
  useEffect(() => {
    const update = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return layout ? scrollFraction(layout, scrollY) : 0;
}

/** Whether an element has scrolled up out of the window. */
function useScrolledPast(element: HTMLElement | null): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setPast(entry ? !entry.isIntersecting && entry.boundingClientRect.top < 0 : false),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return past;
}
