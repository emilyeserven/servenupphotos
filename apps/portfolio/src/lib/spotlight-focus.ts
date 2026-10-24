import type { SpotlightFocus } from "@/lib/photos";

/**
 * The CSS `object-position` that keeps a photo's focus point in view when it's cropped to fill
 * the screen, or its middle without one.
 */
export function objectPosition(focus: SpotlightFocus | null): string {
  return focus ? `${focus.x}% ${focus.y}%` : "50% 50%";
}
