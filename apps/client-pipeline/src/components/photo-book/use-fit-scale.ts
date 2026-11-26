import { type RefObject, useLayoutEffect, useState } from "react";
import { fitScale } from "@/lib/photo-book-entry-sizes";

/**
 * How much **Shrink lines to fit** shrinks the text in `text` (an inline span at `size` em) so it
 * stays on one line of `line` (the block it's in): 1 when it fits or the option is off, null when
 * it would need shrinking too far and wraps instead. Measured on screen when the line first shows,
 * when its width changes and once the fonts have loaded.
 */
export function useFitScale(
  line: RefObject<HTMLElement | null>,
  text: RefObject<HTMLElement | null>,
  options: { on: boolean; size: number; name: string },
): number | null {
  const { on, size, name } = options;
  const [scale, setScale] = useState<number | null>(1);
  useLayoutEffect(() => {
    const box = line.current;
    const inner = text.current;
    if (!on || !box || !inner) return undefined;
    const measure = () => setScale(fitScale(naturalWidth(inner, size), box.clientWidth));
    const resized = new ResizeObserver(measure);
    resized.observe(box);
    let live = true;
    void document.fonts?.ready.then(() => live && measure());
    return () => {
      live = false;
      resized.disconnect();
    };
  }, [line, text, on, size, name]);
  return on ? scale : 1;
}

/**
 * How wide the text is on one line at size em, in the line's own pixels (not the preview's scale),
 * its style put back after measuring so React's stays.
 */
function naturalWidth(inner: HTMLElement, size: number): number {
  const { whiteSpace, fontSize } = inner.style;
  inner.style.whiteSpace = "nowrap";
  inner.style.fontSize = `${size}em`;
  const parent = inner.parentElement;
  const rect = inner.getBoundingClientRect().width;
  const shown = parent?.getBoundingClientRect().width ?? 0;
  const scale = parent && shown > 0 ? parent.clientWidth / shown : 1;
  inner.style.whiteSpace = whiteSpace;
  inner.style.fontSize = fontSize;
  return rect * scale;
}
