import { type TouchEvent, useRef } from "react";

/** How far, in pixels, a finger has to move sideways for a swipe. */
const MIN_DISTANCE = 50;
/** How many times further sideways than up or down a swipe has to move, so a scroll isn't one. */
const MIN_SLOPE = 1.5;
/** The longest a swipe can take, in milliseconds, so a slow drag isn't one. */
const MAX_DURATION = 800;

/** Where and when a one-finger touch began. */
interface TouchStart {
  x: number;
  y: number;
  time: number;
}

/** The touch handlers a swipe needs, to spread onto the element that hears it. */
interface SwipeHandlers {
  onTouchStart: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
  onTouchCancel: () => void;
}

/** Whether the page is pinch-zoomed in, when a sideways drag pans it instead of swiping. */
function isZoomedIn(): boolean {
  return (window.visualViewport?.scale ?? 1) > 1.01;
}

/** Where a one-finger touch began, or null for a pinch or when the page is zoomed in. */
function startOf(event: TouchEvent): TouchStart | null {
  const touch = event.touches[0];
  if (!touch || event.touches.length !== 1 || isZoomedIn()) return null;
  return { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
}

/** Whether a touch that moved dx and dy pixels in duration milliseconds was a sideways swipe. */
function isSwipe(dx: number, dy: number, duration: number): boolean {
  const isSideways = Math.abs(dx) >= MIN_DISTANCE && Math.abs(dx) > MIN_SLOPE * Math.abs(dy);
  return isSideways && duration <= MAX_DURATION;
}

/** -1 for a swipe right (back), 1 for a swipe left (on), or 0 when the touch wasn't a swipe. */
function swipeDirection(start: TouchStart, event: TouchEvent): number {
  const touch = event.changedTouches[0];
  if (!touch) return 0;
  const dx = touch.clientX - start.x;
  if (!isSwipe(dx, touch.clientY - start.y, event.timeStamp - start.time)) return 0;
  return Math.sign(-dx);
}

/**
 * Calls onStep with -1 when a finger swipes right and 1 when it swipes left, like turning a page.
 * It only listens, never stopping the browser's own scrolling or pinch-zoom: a second finger, a
 * mostly up-or-down move, or a page that's zoomed in isn't a swipe.
 */
export function useSwipe(onStep: (by: number) => void): SwipeHandlers {
  const start = useRef<TouchStart | null>(null);
  return {
    onTouchStart: (event) => {
      // A second finger joining makes it a pinch, so it's not a swipe even after one lifts.
      start.current = startOf(event);
    },
    onTouchEnd: (event) => {
      const began = start.current;
      if (event.touches.length > 0 || !began) return;
      start.current = null;
      const by = swipeDirection(began, event);
      if (by !== 0) onStep(by);
    },
    onTouchCancel: () => {
      start.current = null;
    },
  };
}
