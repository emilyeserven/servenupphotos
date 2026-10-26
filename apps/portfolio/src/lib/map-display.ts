import { useState } from "react";

/** How big the map's markers are. */
export type PinSize = "small" | "medium" | "large";

/** How the map draws its markers, as chosen in its display options. */
export interface MapDisplay {
  /**
   * How close photos are, in pixels on the screen, before they're grouped into one marker: less
   * shows more photos on their own, more groups them sooner.
   */
  grouping: number;
  pinSize: PinSize;
  /** Whether a group's marker shows how many photos it has. */
  showCounts: boolean;
  /** Whether a group's photos are darkened under its count, rather than shown as they are. */
  dimGroups: boolean;
}

/** The display options a first visit starts with. */
export const DEFAULT_MAP_DISPLAY: MapDisplay = {
  grouping: 40,
  pinSize: "medium",
  showCounts: true,
  dimGroups: true,
};

/** The grouping slider's range and step, in pixels. */
export const GROUPING_RANGE = { min: 10, max: 100, step: 5 } as const;

/** Each pin size's width, in pixels. */
export const PIN_PIXELS: Record<PinSize, number> = { small: 32, medium: 44, large: 60 };

/** How far apart photo markers are kept at least, in pixels: a marker and a gap. */
export function pinSpacing(pinSize: PinSize): number {
  return PIN_PIXELS[pinSize] + 6;
}

const STORAGE_KEY = "servenup-map-display";

/** The display options saved in this browser, filled in from the defaults. */
function readStored(): MapDisplay {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { ...DEFAULT_MAP_DISPLAY, ...validDisplay(stored) };
  } catch {
    // Storage can be blocked (private mode, disabled cookies), or hold something unreadable.
    return DEFAULT_MAP_DISPLAY;
  }
}

/** Whether a saved value is still a valid choice, for each option. */
const VALID: Record<keyof MapDisplay, (value: unknown) => boolean> = {
  grouping: (value) =>
    typeof value === "number" && value >= GROUPING_RANGE.min && value <= GROUPING_RANGE.max,
  pinSize: (value) => typeof value === "string" && value in PIN_PIXELS,
  showCounts: (value) => typeof value === "boolean",
  dimGroups: (value) => typeof value === "boolean",
};

/** The options in a saved value that are still valid, leaving out the rest. */
function validDisplay(stored: unknown): Partial<MapDisplay> {
  if (typeof stored !== "object" || stored === null) return {};
  const saved = stored as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(VALID)
      .filter(([key, valid]) => valid(saved[key]))
      .map(([key]) => [key, saved[key]]),
  );
}

/**
 * The map's display options and a function to change some of them. They're remembered in this
 * browser, like the theme, so the map looks the same next time.
 */
export function useMapDisplay(): [MapDisplay, (change: Partial<MapDisplay>) => void] {
  const [display, setDisplay] = useState(readStored);
  function change(next: Partial<MapDisplay>) {
    const updated = { ...display, ...next };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore; the choice still applies for this visit.
    }
    setDisplay(updated);
  }
  return [display, change];
}
