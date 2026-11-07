import { subDays, subMonths, subYears } from "date-fns";
import { findTimelineLabel } from "@portfolio/lib/timeline-labels";
import { currentChoice, dayOf, type WhenFilters } from "@portfolio/lib/when-filters";

/**
 * Where each old quick range (`?range=30d`) started, counted back from today. "All time" (`all`)
 * has no start, so it isn't here.
 */
const RANGE_STARTS: Record<string, (now: Date) => Date> = {
  "7d": (now) => subDays(now, 7),
  "30d": (now) => subDays(now, 30),
  "90d": (now) => subDays(now, 90),
  "6m": (now) => subMonths(now, 6),
  "1y": (now) => subYears(now, 1),
};

/** Which "when" filter each old Quick dates choice (`?when=month`) becomes: this month or this season. */
const QUICK_DATE_LISTS: Record<string, "month" | "season"> = {
  date: "month",
  month: "month",
  season: "season",
};

/** The text in the URL's search under the key, or undefined for anything else. */
function text(search: Record<string, unknown>, key: string): string | undefined {
  const value = search[key];
  return typeof value === "string" && value ? value : undefined;
}

/** The old absolute range (`?from=…&to=…`) as the date range filter, when both ends are there. */
function fromAbsolute(search: Record<string, unknown>): WhenFilters | undefined {
  const from = text(search, "from");
  const to = text(search, "to");
  return from && to ? { start: from, end: to } : undefined;
}

/** The old quick range (`?range=30d`) as a date range filter from that many days ago. */
function fromQuickRange(search: Record<string, unknown>, now: Date): WhenFilters | undefined {
  const start = RANGE_STARTS[text(search, "range") ?? ""];
  return start ? { start: dayOf(start(now)) } : undefined;
}

/** The old label picker's choice (`?label=japan-2026-09-22`) as a date range filter of its days. */
function fromLabel(search: Record<string, unknown>): WhenFilters | undefined {
  const label = findTimelineLabel(text(search, "label"));
  return label ? { start: label.start, end: label.end } : undefined;
}

/** The old Quick dates choice (`?when=season`) as this month's or this season's filter. */
function fromQuickDate(search: Record<string, unknown>, now: Date): WhenFilters | undefined {
  const key = QUICK_DATE_LISTS[text(search, "when") ?? ""];
  return key ? { [key]: [currentChoice(key, now).value] } : undefined;
}

/**
 * The URL's search with the Timeline's old time range, label and Quick dates keys turned into the
 * Filters' "when" keys, so links made before those pickers were removed show the same photos. Each
 * old link set only one of them. A "when" filter already in the URL is kept as it is.
 */
export function withOldTimelineLinks(
  search: Record<string, unknown>,
  now: Date,
): Record<string, unknown> {
  const old =
    fromAbsolute(search) ??
    fromQuickRange(search, now) ??
    fromLabel(search) ??
    fromQuickDate(search, now);
  return { ...old, ...search };
}
