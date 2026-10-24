import { useCallback, useEffect, useRef, useState } from "react";
import type { WheelView } from "@/lib/use-wheel-zoom";

/** How long an animated zoom takes, in milliseconds: slow enough to follow where it's going. */
const ANIMATION_MS = 700;

/**
 * The view part way (t, from 0 to 1) from one view to another. The zoom changes by the same factor
 * each step, so zooming in 2× then 4× takes as long as 1× to 2×, and the middle moves evenly.
 */
function viewBetween(from: WheelView, to: WheelView, t: number): WheelView {
  return {
    zoom: from.zoom * (to.zoom / from.zoom) ** t,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

/** Starts slowly, speeds up, then slows down to a stop. */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Whether the viewer has asked for less motion, so views change at once. */
function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Animates the view with show, a frame at a time, from one view to another, as the color wheel's
 * and Black & white chart's zoom buttons and clusters do. `target` is the view it's heading to
 * while it runs, and null otherwise; `stop` stops it where it is, as a drag or pinch does.
 */
export function useViewAnimation(show: (view: WheelView) => void) {
  const frame = useRef(0);
  const [target, setTarget] = useState<WheelView | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    setTarget(null);
  }, []);

  const animate = useCallback(
    (from: WheelView, to: WheelView) => {
      cancelAnimationFrame(frame.current);
      if (prefersReducedMotion()) return show(to);
      setTarget(to);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ANIMATION_MS);
        show(viewBetween(from, to, easeInOut(t)));
        if (t < 1) frame.current = requestAnimationFrame(step);
        else setTarget(null);
      };
      frame.current = requestAnimationFrame(step);
    },
    [show],
  );

  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return { target, animate, stop };
}
