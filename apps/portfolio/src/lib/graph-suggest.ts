import type { GraphType } from "@portfolio/lib/graph-data";

/** How well a graph type suits what's on the axes. */
export type Fit = "best" | "good" | "poor";

/** A graph type's fit for what's on the axes, with one plain sentence saying why. */
export interface TypeFit {
  fit: Fit;
  reason: string;
}

/** What's on the graph's axes, which the suggestion is read from. */
export interface SuggestAxes {
  /** The x axis's stat ID, such as "year" or "lenses". */
  x: string;
  /** How many values the x axis shows, which a pie's slices are counted from. */
  xCount: number;
  /** The y axis's stat ID, only while the graph compares two stats (a scatterplot or heatmap). */
  y?: string;
}

/** What a stat is: a *time*, a camera setting's *scale* of numbers, or a *category* with no order. */
type StatKind = "time" | "scale" | "category";

/** The stats that aren't categories, by ID; any other stat, such as one added later, is a category. */
const KINDS: Record<string, StatKind> = {
  year: "time",
  season: "time",
  month: "time",
  daypart: "time",
  weekday: "time",
  aperture: "scale",
  exposure: "scale",
  "shutter-speed": "scale",
  iso: "scale",
  "iso-ranges": "scale",
  "aperture-ranges": "scale",
  focalLength: "scale",
  "focal-length": "scale",
  lightness: "scale",
};

/** The stat's kind. */
function kindOf(id: string): StatKind {
  return KINDS[id] ?? "category";
}

/** The stats where one photo can count in several rows, besides the camera categories. */
const MANY_ROWS: ReadonlySet<string> = new Set(["lens-brands", "genre", "tags"]);

/**
 * Whether one photo can count in several of the stat's rows: the lens and camera categories set on
 * the pipeline (each camera, `cameras-0`, can't), genres and tags.
 */
function manyRows(id: string): boolean {
  return MANY_ROWS.has(id) || /^cameras-[1-9]/.test(id);
}

/** A type's fit and why, as written in the tables below. */
type Rule = [Fit, string];

/** A dot for every photo, which suits any stat. */
const DOTS: Rule = ["good", "A dot for every photo, stacked like bars you can count."];

/** How the bar, line and photo dot graphs suit each kind of x axis, with Year apart from the other times. */
const ONE_STAT: Record<StatKind | "year", Record<"bar" | "line" | "photos", Rule>> = {
  year: {
    line: ["best", "A line shows how the count changes from year to year."],
    bar: ["good", "Bars compare the years side by side."],
    photos: DOTS,
  },
  time: {
    bar: ["best", "Bars compare each part of a repeating time, such as each month."],
    line: ["good", "A line follows the order, though these values come round again."],
    photos: DOTS,
  },
  scale: {
    photos: ["best", "A dot for every photo shows how many were taken at each setting."],
    bar: ["good", "Bars compare the settings from low to high."],
    line: ["good", "A line follows the setting from low to high."],
  },
  category: {
    bar: ["best", "Bars compare separate values, such as cameras or countries."],
    line: ["poor", "A line suggests an order these don't have."],
    photos: DOTS,
  },
};

/** How many slices a pie gives their own color before the rest go into Other. */
const PIE_SLICES = 8;

/** How a pie suits the x axis: only a category with a few values, each photo in one slice. */
function pieFit(axes: SuggestAxes): Rule {
  if (manyRows(axes.x)) {
    return ["poor", "A photo can be in more than one slice, so the shares pass 100%."];
  }
  if (kindOf(axes.x) !== "category") return ["poor", "Slices lose the order these values have."];
  if (axes.xCount > PIE_SLICES) return ["poor", "Past 8 slices the rest go into Other."];
  return ["good", "Slices show each value's share of the photos."];
}

/** How the scatterplot and heatmap suit the axes: they compare two stats, best both with an order. */
function twoStatFits(axes: SuggestAxes): Record<"scatter" | "heatmap", Rule> {
  const ordered =
    axes.y !== undefined && kindOf(axes.x) !== "category" && kindOf(axes.y) !== "category";
  return {
    heatmap: [
      ordered ? "best" : "good",
      "Compares two stats as a grid, each cell as dark as the photos with both.",
    ],
    scatter: ["good", "Compares two stats, with a dot as big as the photos with both."],
  };
}

/** The bar, line and photo dot graphs' fits; never best while the graph compares two stats, since they show only one. */
function oneStatFits(axes: SuggestAxes): Record<"bar" | "line" | "photos", Rule> {
  const kind = kindOf(axes.x);
  const rules = ONE_STAT[axes.x === "year" ? "year" : kind];
  if (axes.y === undefined) return rules;
  const capped = ([fit, reason]: Rule): Rule => [fit === "best" ? "good" : fit, reason];
  return { bar: capped(rules.bar), line: capped(rules.line), photos: capped(rules.photos) };
}

/** The graph types in the Graph type picker's order, which picks the suggestion when two tie. */
const TYPES: GraphType[] = ["bar", "line", "pie", "scatter", "heatmap", "photos"];

/**
 * Each graph type's fit for what's on the axes, `best`, `good` or `poor`, with one sentence saying
 * why, from the kind of each stat (a time, a camera setting's scale or a category) and how many
 * values the x axis has.
 */
export function typeFits(axes: SuggestAxes): Record<GraphType, TypeFit> {
  const rules: Record<GraphType, Rule> = {
    ...oneStatFits(axes),
    pie: pieFit(axes),
    ...twoStatFits(axes),
  };
  return Object.fromEntries(
    TYPES.map((type) => [type, { fit: rules[type][0], reason: rules[type][1] }]),
  ) as Record<GraphType, TypeFit>;
}

/** The graph type that suits the axes best, or none when no type stands out. */
export function suggestedType(fits: Record<GraphType, TypeFit>): GraphType | undefined {
  return TYPES.find((type) => fits[type].fit === "best");
}
