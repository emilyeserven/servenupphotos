import { useEffect, useState } from "react";

/**
 * Which of `count` images to show, moving on to the next one every `ms` milliseconds, for images
 * that fade in and out in turn. With reduced motion, the first one just stays.
 */
export function useTurn(count: number, ms: number): number {
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setTurn((t) => t + 1), ms);
    return () => clearInterval(timer);
  }, [count, ms]);
  return count === 0 ? 0 : turn % count;
}
