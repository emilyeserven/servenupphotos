import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * How many pages a flow needs: its columns run on to the right, one window width and one column
 * gap per page, so the right edge of its last line says how many. Measured on screen, so a preview
 * drawn smaller measures the same.
 */
function pagesNeeded(box: HTMLElement, content: HTMLElement): number | null {
  const window = box.getBoundingClientRect();
  const lines = content.querySelectorAll("span");
  const last = lines[lines.length - 1];
  if (window.width === 0 || !last) return null;
  const scale = window.width / box.clientWidth;
  const gap = (Number.parseFloat(getComputedStyle(content).columnGap) || 0) * scale;
  const right = last.getBoundingClientRect().right - content.getBoundingClientRect().left;
  return Math.max(1, Math.ceil((right + gap) / (window.width + gap)));
}

/**
 * How many pages the flow in `flow` needs, its columns running on past its window (`window`) to
 * the right; measured when the window first shows and changes size, and whenever the flow's text
 * or style changes; null until then.
 */
export function usePagesNeeded(
  window: RefObject<HTMLElement | null>,
  flow: RefObject<HTMLElement | null>,
): number | null {
  const [needed, setNeeded] = useState<number | null>(null);
  useLayoutEffect(() => {
    const box = window.current;
    const content = flow.current;
    if (!box || !content) return undefined;
    const measure = () => setNeeded(pagesNeeded(box, content));
    const resized = new ResizeObserver(measure);
    resized.observe(box);
    const changed = new MutationObserver(measure);
    changed.observe(content, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    return () => {
      resized.disconnect();
      changed.disconnect();
    };
  }, [window, flow]);
  return needed;
}
