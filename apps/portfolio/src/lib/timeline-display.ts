/** How big the Timeline's thumbnails are: small (the default, left out of the URL) up to huge. */
export type ThumbSize = "small" | "medium" | "large" | "huge";

/** The thumbnail sizes in the order the options list them, with their labels. */
export const THUMB_SIZES = [
  ["small", "Small"],
  ["medium", "Medium"],
  ["large", "Large"],
  ["huge", "Huge"],
] as const satisfies readonly (readonly [ThumbSize, string])[];

/**
 * Each thumbnail size's square, and how its row lays out. Large and huge thumbnails sit above
 * their title on a phone, where there'd be no room beside them.
 */
export const THUMB_LAYOUT: Record<ThumbSize, { thumbnail: string; row: string }> = {
  small: { thumbnail: "size-25", row: "flex-row items-center" },
  medium: { thumbnail: "size-40", row: "flex-row items-center" },
  large: { thumbnail: "size-60", row: "flex-col items-start sm:flex-row sm:items-center" },
  huge: { thumbnail: "size-80", row: "flex-col items-start sm:flex-row sm:items-center" },
};

/**
 * The Timeline's display options as they're kept in its URL, each left out at its default:
 * `?thumbs=large` for the thumbnail size, `?tech=true` to show technical info, and
 * `?comments=false` or `?places=false` to hide comments or places.
 */
export interface TimelineDisplaySearch {
  thumbs?: Exclude<ThumbSize, "small">;
  tech?: true;
  comments?: false;
  places?: false;
}

/** The Timeline's display options with every default filled in. */
export interface TimelineDisplay {
  /** How big each photo's thumbnail is. */
  thumbs: ThumbSize;
  /** Whether each photo shows its aperture, exposure, ISO, focal length, lens and camera. */
  tech: boolean;
  /** Whether each photo shows its comment. */
  comments: boolean;
  /** Whether each photo shows where it was taken. */
  places: boolean;
}

/** The options a Timeline opens with when its URL sets none. */
export const DEFAULT_TIMELINE_DISPLAY: TimelineDisplay = {
  thumbs: "small",
  tech: false,
  comments: true,
  places: true,
};

/** The display options in a Timeline URL's search, dropping any it doesn't know. */
export function parseTimelineDisplay(search: Record<string, unknown>): TimelineDisplaySearch {
  return {
    ...parseThumbs(search.thumbs),
    ...(search.tech === true ? { tech: true } : {}),
    ...(search.comments === false ? { comments: false } : {}),
    ...(search.places === false ? { places: false } : {}),
  };
}

/** `?thumbs=` when it's one of the sizes above small. */
function parseThumbs(value: unknown): Pick<TimelineDisplaySearch, "thumbs"> {
  const size = THUMB_SIZES.find(([option]) => option !== "small" && option === value)?.[0];
  return size ? { thumbs: size as Exclude<ThumbSize, "small"> } : {};
}

/** The display options a URL's search sets, with the defaults for the rest. */
export function resolveTimelineDisplay(search: TimelineDisplaySearch): TimelineDisplay {
  return {
    thumbs: search.thumbs ?? "small",
    tech: search.tech === true,
    comments: search.comments !== false,
    places: search.places !== false,
  };
}

/**
 * The search for a set of display options, with each one at its default set to `undefined` so that
 * spreading it over the URL's search takes it out.
 */
export function timelineDisplaySearch(display: TimelineDisplay): TimelineDisplaySearch {
  return {
    thumbs: thumbsParam(display.thumbs),
    tech: display.tech ? true : undefined,
    comments: hiddenParam(display.comments),
    places: hiddenParam(display.places),
  };
}

/** `?thumbs=` for a size, left out for small. */
function thumbsParam(size: ThumbSize): TimelineDisplaySearch["thumbs"] {
  return size === "small" ? undefined : size;
}

/** `false` for something hidden, left out when it's shown. */
function hiddenParam(shown: boolean): false | undefined {
  return shown ? undefined : false;
}
