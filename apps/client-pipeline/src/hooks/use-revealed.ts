import { useEffect, useRef, useState } from "react";

/** How many tiles a long grid draws at first, and adds each time the bottom comes near. */
const TILE_BATCH = 96;

/** How far below the screen the end of the drawn tiles can be before more are added. */
const AHEAD = "1500px";

/**
 * Draws a long list in batches of batch items (a screenful of small tiles by default). It gives
 * how many of total items to show so far, and a ref for an empty element after them. The first
 * batch shows at once, and the next is added whenever that element scrolls to within AHEAD of the
 * screen, so a page with a thousand photos opens without drawing them all first.
 */
export function useRevealed(total: number, batch = TILE_BATCH) {
  const [count, setCount] = useState(batch);
  const end = useRef<HTMLDivElement>(null);
  const shown = Math.min(count, total);

  useEffect(() => {
    const node = end.current;
    if (!node || shown >= total) return;
    // Observing again after each batch also reports at once when the end is still in reach.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setCount((c) => c + batch);
      },
      { rootMargin: `0px 0px ${AHEAD} 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, total, batch]);

  return [shown, end] as const;
}
