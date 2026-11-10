import {
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** The zoom steps the − and + buttons go through; Ctrl + scroll or a pinch zooms anywhere between. */
const STEPS = [1, 1.5, 2, 3, 4, 6, 8];
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

/** A point in the viewport, and where it is on the photo as a fraction of its size. */
interface Anchor {
  x: number;
  y: number;
  fx: number;
  fy: number;
}

interface Point {
  x: number;
  y: number;
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The next step in, or out, from zoom. */
function stepFrom(zoom: number, direction: 1 | -1): number {
  if (direction === 1) return STEPS.find((step) => step > zoom + 0.01) ?? MAX_ZOOM;
  return STEPS.toReversed().find((step) => step < zoom - 0.01) ?? MIN_ZOOM;
}

/** The canvas's width when it fits the viewport, measured while it's unzoomed. */
function useFitWidth(canvas: RefObject<HTMLCanvasElement | null>, zoom: number): number {
  const [fit, setFit] = useState(0);
  useEffect(() => {
    const element = canvas.current;
    if (!element || zoom !== 1) return;
    const observer = new ResizeObserver(() => setFit(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [canvas, zoom]);
  return fit;
}

/** The zoom, and the point to keep in place while the canvas takes its new size. */
interface View {
  zoom: number;
  anchor: Anchor | null;
}

/** Where the viewport's point `at` (its middle, unless set) is on the photo. */
function anchorAt(box: HTMLElement, element: HTMLElement, at?: Point): Anchor {
  const point = at ?? { x: box.clientWidth / 2, y: box.clientHeight / 2 };
  const fx = (box.scrollLeft + point.x) / element.clientWidth;
  const fy = (box.scrollTop + point.y) / element.clientHeight;
  return { ...point, fx, fy };
}

/** Scrolls so the photo's point in view.anchor is back under it once the canvas has its new size. */
function useKeepAnchor(
  viewport: RefObject<HTMLDivElement | null>,
  canvas: RefObject<HTMLCanvasElement | null>,
  view: View,
) {
  useLayoutEffect(() => {
    const [box, element, at] = [viewport.current, canvas.current, view.anchor];
    if (!box || !element || !at) return;
    box.scrollLeft = at.fx * element.clientWidth - at.x;
    box.scrollTop = at.fy * element.clientHeight - at.y;
  }, [viewport, canvas, view]);
}

/** Ctrl (or ⌘) + scroll, and a trackpad pinch, zoom toward the pointer. */
function useWheelZoom(
  viewport: RefObject<HTMLDivElement | null>,
  zoomTo: (next: (zoom: number) => number, at?: Point) => void,
) {
  useEffect(() => {
    const box = viewport.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      // Without this, the browser zooms the whole page.
      event.preventDefault();
      const rect = box.getBoundingClientRect();
      const at = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      zoomTo((zoom) => zoom * Math.exp(-event.deltaY / 400), at);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [viewport, zoomTo]);
}

/** Dragging scrolls the zoomed photo instead of drawing a box, while moving is on. */
function usePan(viewport: RefObject<HTMLDivElement | null>) {
  const from = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const end = () => {
    from.current = null;
  };
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      const box = viewport.current;
      if (!box) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      from.current = {
        x: event.clientX,
        y: event.clientY,
        left: box.scrollLeft,
        top: box.scrollTop,
      };
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const [box, start] = [viewport.current, from.current];
      if (!box || !start) return;
      box.scrollLeft = start.left - (event.clientX - start.x);
      box.scrollTop = start.top - (event.clientY - start.y);
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}

/**
 * How far the preview is zoomed in, and the ways to change it: steps for the buttons, Ctrl + scroll
 * or a pinch toward the pointer, and dragging to move around the zoomed photo.
 */
export function usePreviewZoom(
  viewport: RefObject<HTMLDivElement | null>,
  canvas: RefObject<HTMLCanvasElement | null>,
) {
  const [view, setView] = useState<View>({ zoom: 1, anchor: null });
  const [moving, setMoving] = useState(false);
  const { zoom } = view;
  const fit = useFitWidth(canvas, zoom);
  useKeepAnchor(viewport, canvas, view);

  /** Zooms to next(zoom), keeping the photo's point at `at` (the middle, unless set) in place. */
  const zoomTo = useCallback(
    (next: (zoom: number) => number, at?: Point) => {
      const [box, element] = [viewport.current, canvas.current];
      if (!box || !element) return;
      const anchor = anchorAt(box, element, at);
      setView((current) => ({ zoom: clampZoom(next(current.zoom)), anchor }));
    },
    [viewport, canvas],
  );
  useWheelZoom(viewport, zoomTo);
  // Moving around only makes sense on a zoomed photo.
  const movingNow = moving && zoom > 1;

  return {
    zoom,
    /** The canvas's size for this zoom, or nothing to let it fit the viewport. */
    canvasStyle: zoom === 1 || fit === 0 ? null : { width: fit * zoom, maxWidth: "none" },
    canZoomIn: zoom < MAX_ZOOM,
    canZoomOut: zoom > MIN_ZOOM,
    zoomIn: () => zoomTo((current) => stepFrom(current, 1)),
    zoomOut: () => zoomTo((current) => stepFrom(current, -1)),
    fit: () => zoomTo(() => 1),
    /** Whether dragging moves around the photo rather than drawing a box. */
    moving: movingNow,
    toggleMoving: () => setMoving((on) => !on),
    pan: usePan(viewport),
  };
}

/** The preview's zoom, from `usePreviewZoom`. */
export type PreviewZoom = ReturnType<typeof usePreviewZoom>;
