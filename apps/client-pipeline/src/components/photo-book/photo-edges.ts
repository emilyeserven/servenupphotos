import { type CSSProperties, type RefObject, useLayoutEffect, useState } from "react";

/** Marks a photo's place as drawn, in its kept shape, so text can be lined up with its edges. */
export const PHOTO_BOX_ATTRIBUTE = "data-photo-box";

/** Where the photos are drawn inside an element, in pixels from its top left. */
interface Edges {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The box around every photo drawn inside root, from root's top left; null with none. */
function photoEdges(root: HTMLElement): Edges | null {
  const boxes = [...root.querySelectorAll(`[${PHOTO_BOX_ATTRIBUTE}]`)].map((box) =>
    box.getBoundingClientRect(),
  );
  if (boxes.length === 0) return null;
  const outer = root.getBoundingClientRect();
  const top = Math.min(...boxes.map((b) => b.top));
  const left = Math.min(...boxes.map((b) => b.left));
  return {
    top: top - outer.top,
    left: left - outer.left,
    width: Math.max(...boxes.map((b) => b.right)) - left,
    height: Math.max(...boxes.map((b) => b.bottom)) - top,
  };
}

/**
 * The style that keeps a layout's text room as long as the photos beside it are drawn, rather than
 * all their room: as tall as them and level with them when the text is beside the photos, as wide
 * as them and in line with them when it's above or below. Nothing when off, or until measured;
 * it's measured again whenever root changes size.
 */
export function usePhotoEdges(
  root: RefObject<HTMLElement | null>,
  on: boolean,
  beside: boolean,
): CSSProperties {
  const [edges, setEdges] = useState<Edges | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!on || !element) return;
    const measure = () => setEdges(photoEdges(element));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const box of element.querySelectorAll(`[${PHOTO_BOX_ATTRIBUTE}]`)) observer.observe(box);
    return () => observer.disconnect();
  }, [root, on]);
  if (!on || !edges) return {};
  return beside
    ? { alignSelf: "flex-start", marginTop: edges.top, height: edges.height }
    : { alignSelf: "flex-start", marginLeft: edges.left, width: edges.width };
}
