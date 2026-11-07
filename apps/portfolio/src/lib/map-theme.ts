import { useSyncExternalStore } from "react";

/**
 * The free CARTO basemaps for light and dark mode, which the portfolio's map and the pipeline's
 * trip line map share.
 */
export const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

// The theme provider toggles the `dark` class on <html>; follow it so the map matches.
function subscribeToDarkClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** Whether the page is in dark mode, following the `dark` class on <html>. */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribeToDarkClass, () =>
    document.documentElement.classList.contains("dark"),
  );
}

/**
 * The light blue an area is drawn in (a place's area, or a trip line's area for photos without an
 * exact spot): Tailwind's sky, a stand-in for the Serven Up Websites brand blue, kept apart from the
 * walking lines' darker blue. Its edge is darker on the light basemap and lighter on the dark one.
 */
const AREA_COLORS = {
  light: { fill: "#38bdf8", edge: "#0284c7" },
  dark: { fill: "#38bdf8", edge: "#7dd3fc" },
};

/** An area's fill paint: more opaque while it's pointed at. */
export function areaFillPaint(dark: boolean, hovered = false) {
  const colors = dark ? AREA_COLORS.dark : AREA_COLORS.light;
  return { "fill-color": colors.fill, "fill-opacity": hovered ? 0.35 : 0.22 };
}

/** An area's dashed edge paint. */
export function areaEdgePaint(dark: boolean) {
  const colors = dark ? AREA_COLORS.dark : AREA_COLORS.light;
  return { "line-color": colors.edge, "line-width": 2, "line-dasharray": [3, 2] };
}
