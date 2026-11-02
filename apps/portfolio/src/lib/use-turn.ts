import { useCallback, useEffect, useState } from "react";

/** Which of a set of images is showing, and a way to step to another one. */
export interface Turn {
  /** The index of the image showing. */
  turn: number;
  /** Shows the image by places after the one showing, or before it when by is negative. */
  step: (by: number) => void;
}

/** Whether the viewer asked for reduced motion. */
function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Which of `count` images to show, moving on to the next one every `ms` milliseconds, for images
 * that fade in and out in turn, starting at `start` (the first by default). A step starts the wait
 * again. With reduced motion, the one it starts at stays until stepped.
 */
export function useTurn(count: number, ms: number, start = 0): Turn {
  const [turn, setTurn] = useState(start);
  useEffect(() => {
    if (count < 2 || reducedMotion()) return;
    const timer = setTimeout(() => setTurn((t) => t + 1), ms);
    return () => clearTimeout(timer);
  }, [count, ms, turn]);
  const step = useCallback((by: number) => setTurn((t) => t + by), []);
  return { turn: count === 0 ? 0 : ((turn % count) + count) % count, step };
}
