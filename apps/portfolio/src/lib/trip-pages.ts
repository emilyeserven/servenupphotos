import committedPages from "@/data/triplines/TRIPPAGES.json";
import { format, parseISO } from "date-fns";
import type { PhotoText } from "@/components/album-rows";
import type { ImagePhoto } from "@/lib/spotlight-zones";

/** One photo of a day's story on a Trip page, as the pipeline wrote it. */
interface StoryPhoto {
  id: number;
  /** Its own text (Markdown). */
  text?: string;
  /** Shows the photo's Comment in place of `text`. */
  useComment?: boolean;
  /** Where the text goes: left out, under the photo as a caption; or a paragraph to its left or right. */
  textSide?: "left" | "right";
  /** Puts the next photo in the same row, side by side. */
  withNext?: boolean;
  /** A paragraph (Markdown) after the photo, across the page, which ends its row. */
  after?: string;
}

/** A casual photo, such as the food at a restaurant: on a Trip page with its place, and nowhere else. */
export interface CasualPhoto {
  id: number;
  title?: string;
  width?: number;
  height?: number;
  /** Its resized versions' URLs, by name, as a photo's are. */
  images?: Partial<Record<"xsmall" | "small" | "medium" | "large" | "xlarge", string | null>>;
}

/** A trip stop on a day, such as a restaurant, with the casual photos taken there. */
export interface TripStop {
  name: string;
  /** What sort of place it is, such as "restaurant" or "cafe". */
  kind: string;
  note?: string;
  /** Its page on an outside map. */
  link?: string;
  /** The photo it comes after on the route, which places it in the story; left out when it isn't on the route. */
  after?: number;
  /** Its casual photos; left out for none. */
  photos?: CasualPhoto[];
}

/** One day's story on a Trip page. */
interface TripPageDay {
  /** The day, such as "2026-10-01". */
  day: string;
  /** A paragraph (Markdown) before the day's first photo. */
  intro?: string;
  /** Its photos in order, with their words. */
  photos: StoryPhoto[];
  /** The day's trip stops, each with its casual photos. */
  stops?: TripStop[];
}

/**
 * A Trip page from TRIPPAGES.json, which the pipeline's Commit bakes from the days' stories: a Trip
 * with the stories of its days, or one day in no Trip.
 */
export interface TripPage {
  /** The Trip's ID, or "day-" and the day; its address under /albums/trips/. */
  id: string;
  /** The Trip's name; "" for a day in no Trip, named after the day. */
  name: string;
  /** Its first and last days, such as "2026-09-22". */
  start: string;
  end: string;
  days: TripPageDay[];
}

/** Every Trip page, newest first. */
export const tripPages = committedPages as TripPage[];

/** A day written out, such as "Wednesday, October 1, 2026". */
export function dayTitle(day: string): string {
  return format(parseISO(day), "EEEE, MMMM d, yyyy");
}

/** The page's title: its Trip's name, or else its day. */
export function pageTitle(page: TripPage): string {
  return page.name || dayTitle(page.start);
}

/** The days the page covers, such as "September 22 to October 2, 2026"; one day for a day's page. */
export function pageDates(page: TripPage): string {
  const end = parseISO(page.end);
  if (page.start === page.end) return format(end, "MMMM d, yyyy");
  return `${format(parseISO(page.start), "MMMM d")} to ${format(end, "MMMM d, yyyy")}`;
}

/** A row of a Trip page: photos side by side, the trip stops after them, then the paragraph after them. */
export interface StoryRow {
  photos: ImagePhoto[];
  stops: TripStop[];
  after: string;
}

/** A day of a Trip page as it shows: its paragraph first, then its rows. */
export interface StoryDay {
  day: string;
  intro: string;
  rows: StoryRow[];
  /** The stops not between two of the story's photos, shown after the day. */
  stops: TripStop[];
}

/** Two paragraphs one after the other, as one. */
function joined(a: string, b = ""): string {
  return [a, b.trim()].filter(Boolean).join("\n\n");
}

/** The last row while it's open, or else a new one added after it. */
function openRow(rows: StoryRow[], open: boolean): StoryRow {
  const last = open ? rows.at(-1) : undefined;
  if (last) return last;
  const fresh: StoryRow = { photos: [], stops: [], after: "" };
  rows.push(fresh);
  return fresh;
}

/** Whether the next photo joins the entry's row: it's linked and no paragraph comes between. */
function joinsNext(entry: StoryPhoto): boolean {
  return entry.withNext === true && !entry.after;
}

/** What a day's rows are made from: its photos with images, and its stops, by the photo they follow. */
interface DayParts {
  byId: Map<number, ImagePhoto>;
  stopsAfter: Map<number, TripStop[]>;
}

/**
 * Adds the entry to the open row with the stops after it, and says whether the next one joins it. A
 * stop, like a paragraph, ends the row, so it shows between its two photos. A photo the portfolio
 * doesn't have, such as a draft, still ends its row and keeps its paragraph and stops.
 */
function addEntry(rows: StoryRow[], entry: StoryPhoto, parts: DayParts, open: boolean) {
  const row = openRow(rows, open);
  const photo = parts.byId.get(entry.id);
  if (photo) row.photos.push(photo);
  const stops = parts.stopsAfter.get(entry.id) ?? [];
  row.stops.push(...stops);
  row.after = joined(row.after, entry.after);
  return joinsNext(entry) && stops.length === 0;
}

/** Whether the row shows anything: a photo, a stop or a paragraph. */
function isShown(row: StoryRow): boolean {
  return row.photos.length > 0 || row.stops.length > 0 || row.after !== "";
}

/** The day's rows, leaving out rows left empty. */
function dayRows(entries: StoryPhoto[], parts: DayParts): StoryRow[] {
  const rows: StoryRow[] = [];
  let open = false;
  for (const entry of entries) open = addEntry(rows, entry, parts, open);
  return rows.filter(isShown);
}

/** The stops by the story photo they come after; ones on no story photo are left out. */
function stopsAfter(stops: TripStop[], ids: Set<number>): Map<number, TripStop[]> {
  const out = new Map<number, TripStop[]>();
  for (const stop of stops.filter((s) => ids.has(s.after ?? -1))) {
    out.set(stop.after!, [...(out.get(stop.after!) ?? []), stop]);
  }
  return out;
}

/** The day as it shows, from byId, the photos with images by ID. */
function storyDay(page: TripPageDay, byId: Map<number, ImagePhoto>): StoryDay {
  const { day, intro = "", photos: entries, stops = [] } = page;
  const ids = new Set(entries.map((e) => e.id));
  const parts = { byId, stopsAfter: stopsAfter(stops, ids) };
  return {
    day,
    intro,
    rows: dayRows(entries, parts),
    stops: stops.filter((s) => !ids.has(s.after ?? -1)),
  };
}

/** The page's days as they show, with only the photos among photos (the ones with images). */
export function storyDays(page: TripPage, photos: ImagePhoto[]): StoryDay[] {
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  return page.days.map((day) => storyDay(day, byId));
}

/** The entry's text: the photo's Comment when it says so, or else its own. */
function entryText(entry: StoryPhoto, photo: ImagePhoto | undefined): string {
  const text = entry.useComment ? photo?.comment : entry.text;
  return text?.trim() ?? "";
}

/** Every photo's text on the page and where it goes, by photo ID, from photos, the ones with images. */
export function pageTexts(page: TripPage, photos: ImagePhoto[]): Map<number, PhotoText> {
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const all = page.days.flatMap((d) => d.photos);
  return new Map(
    all.flatMap((entry) => {
      const text = entryText(entry, byId.get(entry.id));
      return text ? [[entry.id, { text, side: entry.textSide ?? "caption" }] as const] : [];
    }),
  );
}

/** The photos the page shows, in order. */
export function shownPhotos(days: StoryDay[]): ImagePhoto[] {
  return days.flatMap((d) => d.rows.flatMap((row) => row.photos));
}
