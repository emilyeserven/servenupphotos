import { GROUPING_RANGE } from "@/lib/map-display";
import { parsePinScale, type PinScale } from "@/lib/pin-scale";

/** What the Black & white chart's height stands for: how contrasty the photos are, or how vivid. */
export type ChartUp = "contrast" | "vividness";

/** How the Color page draws its pins, as chosen in its display options. */
export interface ColorDisplay {
  /** How readily crowded pins are grouped into one, on the same scale as the Map's Grouping. */
  grouping: number;
  /** How big the pins are. */
  pinSize: PinScale;
  /** Whether a group's pin shows how many photos it has. */
  showCounts: boolean;
  /** Whether a group's photo is darkened under its count, rather than shown as it is. */
  dimGroups: boolean;
  /** What the Black & white chart's height stands for. */
  chartUp: ChartUp;
}

/** The display options a Color page opens with when its URL sets none. */
export const DEFAULT_COLOR_DISPLAY: ColorDisplay = {
  grouping: 40,
  pinSize: "small",
  showCounts: true,
  dimGroups: true,
  chartUp: "contrast",
};

/**
 * The Color page's display options as they're kept in its URL, each left out at its default:
 * `?pins=medium`, `?grouping=60`, `?counts=false`, `?dim=false` and `?up=vividness`.
 */
export interface ColorDisplaySearch {
  pins?: Exclude<PinScale, "small">;
  grouping?: number;
  counts?: false;
  dim?: false;
  up?: "vividness";
}

/** The display options in a Color page URL's search, dropping any it doesn't know. */
export function parseColorDisplay(search: Record<string, unknown>): ColorDisplaySearch {
  return withoutUnset({
    pins: parsePinScale(search.pins),
    grouping: groupingOf(search.grouping),
    counts: falseOrUnset(search.counts),
    dim: falseOrUnset(search.dim),
    up: search.up === "vividness" ? "vividness" : undefined,
  });
}

/** The `?grouping=` to keep: a number in the slider's range other than the default. */
function groupingOf(value: unknown): number | undefined {
  return inGroupingRange(value) && value !== DEFAULT_COLOR_DISPLAY.grouping ? value : undefined;
}

/** Whether a value is a number the Grouping slider can be set to. */
function inGroupingRange(value: unknown): value is number {
  return typeof value === "number" && value >= GROUPING_RANGE.min && value <= GROUPING_RANGE.max;
}

/** false when the URL says false, as for a hidden count; otherwise left out. */
function falseOrUnset(value: unknown): false | undefined {
  return value === false ? false : undefined;
}

/** The display options a Color page URL's search picks, with every default filled in. */
export function colorDisplay(search: ColorDisplaySearch): ColorDisplay {
  return {
    ...DEFAULT_COLOR_DISPLAY,
    ...withoutUnset({
      pinSize: search.pins,
      grouping: search.grouping,
      showCounts: search.counts,
      dimGroups: search.dim,
      chartUp: search.up,
    }),
  };
}

/** Display options as the URL keeps them, leaving out each one at its default. */
export function colorDisplaySearch(display: ColorDisplay): ColorDisplaySearch {
  return {
    pins: unlessDefault(display, "pinSize"),
    grouping: unlessDefault(display, "grouping"),
    counts: unlessDefault(display, "showCounts"),
    dim: unlessDefault(display, "dimGroups"),
    up: unlessDefault(display, "chartUp"),
  } as ColorDisplaySearch;
}

/** One of the display's options, or nothing when it's at its default. */
function unlessDefault<K extends keyof ColorDisplay>(display: ColorDisplay, key: K) {
  return display[key] === DEFAULT_COLOR_DISPLAY[key] ? undefined : display[key];
}

/** An object without its keys that are undefined, so spreading it leaves those as they were. */
function withoutUnset<T extends object>(values: T): Partial<{ [K in keyof T]: NonNullable<T[K]> }> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<{ [K in keyof T]: NonNullable<T[K]> }>;
}
