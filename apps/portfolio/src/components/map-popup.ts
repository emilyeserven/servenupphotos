import { cn } from "@portfolio/lib/utils";

/**
 * The classes for a popup on a map, so it matches the page in dark mode. MapLibre styles its popups
 * white, so dark mode recolors the box and its tip under the anchor. Its CSS isn't in a layer, so it
 * beats Tailwind's utilities unless they're important. An outline, which MapLibre doesn't set, sets
 * the box apart from the map.
 */
export const MAP_POPUP = cn(
  // Above a pin brought to the front.
  "z-2",
  "text-neutral-900 dark:text-neutral-100",
  "[&_.maplibregl-popup-content]:outline [&_.maplibregl-popup-content]:outline-black/20 dark:[&_.maplibregl-popup-content]:outline-white/25",
  "dark:[&_.maplibregl-popup-content]:bg-neutral-900!",
  "dark:[&_.maplibregl-popup-tip]:border-t-neutral-900!",
  "dark:[&_.maplibregl-popup-close-button:hover]:bg-white/10!",
);
