import { type RefObject, useEffect, useRef, useState } from "react";
import type { WheelPoint } from "@/lib/color-wheel";

/**
 * What part of the color wheel is in view: how far it's zoomed in (1 shows the whole wheel), and
 * the point in the middle of the view, as fractions (0–1) of the wheel's width and height.
 */
export interface WheelView extends WheelPoint {
  zoom: number;
}

/** The whole wheel, as it starts. */
export const WHOLE_WHEEL: WheelView = { zoom: 1, x: 0.5, y: 0.5 };

/** The furthest the wheel zooms in, and how much each zoom button changes it. */
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 1.5;

/** How far, in pixels, a pointer moves before a press counts as a drag rather than a click. */
const DRAG_PX = 5;

/** value kept from min to max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The view kept within the wheel: zoom from 1 to MAX_ZOOM, and no further out than its edge. */
function clampView({ zoom, x, y }: WheelView): WheelView {
  const z = clamp(zoom, 1, MAX_ZOOM);
  const half = 0.5 / z;
  return { zoom: z, x: clamp(x, half, 1 - half), y: clamp(y, half, 1 - half) };
}

/** The view zoomed by factor, keeping the wheel point at where it is on screen. */
export function zoomAt(view: WheelView, factor: number, at: WheelPoint = view): WheelView {
  const zoom = clamp(view.zoom * factor, 1, MAX_ZOOM);
  const keep = view.zoom / zoom;
  return clampView({ zoom, x: at.x - (at.x - view.x) * keep, y: at.y - (at.y - view.y) * keep });
}

/** The view with point in the middle. */
export function centerOn(view: WheelView, point: WheelPoint): WheelView {
  return clampView({ ...view, ...point });
}

/** The point on the wheel under a pixel offset from the viewport's top left. */
function wheelPointAt(view: WheelView, width: number, px: number, py: number): WheelPoint {
  return { x: view.x + (px / width - 0.5) / view.zoom, y: view.y + (py / width - 0.5) / view.zoom };
}

/**
 * The view of the wheel in viewport (width pixels square), and the ways to change it: dragging
 * pans it, pinching with two fingers or a trackpad (or ctrl + scrolling) zooms it, and `setView`
 * sets it, for the zoom buttons and the mini map. A drag doesn't also click the pin it started on.
 */
export function useWheelZoom(viewport: RefObject<HTMLDivElement | null>, width: number) {
  const [view, setView] = useState(WHOLE_WHEEL);
  const latest = useRef({ view, width });
  useEffect(() => {
    latest.current = { view, width };
  }, [view, width]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    return listenForZoom(element, latest, (update) => setView((v) => update(v)));
  }, [viewport]);

  return { view, setView };
}

/** The view and width when an event comes in. */
type Latest = RefObject<{ view: WheelView; width: number }>;

/** A change to the view, from the view as it is. */
type ViewUpdate = (view: WheelView) => WheelView;

/** Listens on element for drags, pinches and ctrl + scrolling; returns what stops listening. */
function listenForZoom(
  element: HTMLDivElement,
  latest: Latest,
  update: (change: ViewUpdate) => void,
): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let dragged = false;
  // How far, in pixels, the pointers have moved since the press.
  let travel = 0;

  function offset(event: { clientX: number; clientY: number }) {
    const box = element.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const { view, width } = latest.current;
    const at = offset(event);
    const point = wheelPointAt(view, width, at.x, at.y);
    update((v) => zoomAt(v, Math.exp(-event.deltaY / 200), point));
  }

  function onDown(event: PointerEvent) {
    pointers.set(event.pointerId, offset(event));
    dragged = false;
    travel = 0;
  }

  function onMove(event: PointerEvent) {
    const before = pointers.get(event.pointerId);
    if (!before) return;
    const now = offset(event);
    const other = otherPointer(event.pointerId);
    pointers.set(event.pointerId, now);
    travel += Math.hypot(now.x - before.x, now.y - before.y);
    dragged ||= travel > DRAG_PX || other !== undefined;
    const { width } = latest.current;
    update((v) => follow(v, width, before, now, other));
  }

  // Where another finger is down, for a pinch.
  function otherPointer(id: number) {
    return [...pointers].find(([other]) => other !== id)?.[1];
  }

  function onUp(event: PointerEvent) {
    pointers.delete(event.pointerId);
  }

  // A press that turned into a drag doesn't click the pin it started on.
  function onClick(event: MouseEvent) {
    if (!dragged) return;
    event.preventDefault();
    event.stopPropagation();
    dragged = false;
  }

  element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  element.addEventListener("click", onClick, true);
  return () => {
    element.removeEventListener("wheel", onWheel);
    element.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    element.removeEventListener("click", onClick, true);
  };
}

/** The view following a pointer from before to now: pinched when another finger is down at other, else panned. */
function follow(
  view: WheelView,
  width: number,
  before: WheelPoint,
  now: WheelPoint,
  other: WheelPoint | undefined,
): WheelView {
  return other ? pinch(view, width, before, now, other) : pan(view, width, before, now);
}

/** The view panned so the wheel follows a pointer from before to now. */
function pan(view: WheelView, width: number, before: WheelPoint, now: WheelPoint): WheelView {
  const scale = width * view.zoom;
  return centerOn(view, {
    x: view.x - (now.x - before.x) / scale,
    y: view.y - (now.y - before.y) / scale,
  });
}

/**
 * The view zoomed as two fingers move apart or together, one moving from before to now while the
 * other stays at other, keeping the wheel under the point between them in place.
 */
function pinch(
  view: WheelView,
  width: number,
  before: WheelPoint,
  now: WheelPoint,
  other: WheelPoint,
): WheelView {
  const factor =
    Math.hypot(now.x - other.x, now.y - other.y) /
    Math.max(1, Math.hypot(before.x - other.x, before.y - other.y));
  const middle = wheelPointAt(view, width, (now.x + other.x) / 2, (now.y + other.y) / 2);
  return zoomAt(view, factor, middle);
}
