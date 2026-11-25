import type { ContactSheet, ContactSheetPhoto } from "@/api/contact-sheets";
import { lookAtPhotos, tileNote } from "@/lib/contact-sheets";
import { LAYOUTS } from "@/lib/photo-book";
import { takenDay } from "@/lib/style-prompt";
import { promptImageUrl } from "@/lib/tag-prompt";
import { textOf } from "@portfolio/lib/values";

/** A website photo the Import Book prompt lists: its file's path and its JSON. */
export interface CatalogPhoto {
  path: string;
  data: Record<string, unknown>;
}

/** The days the catalog is limited to, as YYYY-MM-DD; "" leaves that end open. */
export interface CatalogDates {
  from: string;
  to: string;
}

/** The name the prompt and the answer call a photo by: its JSON file's name, such as `DSCF4800`. */
export function catalogName(path: string): string {
  return (path.split("/").at(-1) ?? path).replace(/\.json$/, "");
}

/**
 * The photos taken between the dates, both days included, oldest first. With a date set, a photo
 * with no date taken is left out, since it can't be said to be in range.
 */
export function catalogPhotos<T extends CatalogPhoto>(photos: T[], dates: CatalogDates): T[] {
  const open = !dates.from && !dates.to;
  return photos
    .map((photo) => ({ photo, day: takenDay(photo.data) }))
    .filter(({ day }) => open || (day !== "" && inRange(day, dates)))
    .toSorted((a, b) => byDay(a.day, b.day))
    .map(({ photo }) => photo);
}

function inRange(day: string, { from, to }: CatalogDates): boolean {
  return (!from || day >= from) && (!to || day <= to);
}

/** Oldest first, undated ones at the end. */
function byDay(a: string, b: string): number {
  if (!a || !b) return Number(!a) - Number(!b);
  return a.localeCompare(b);
}

/** The image the prompt links for a photo: its Small version, else Medium, else the full image. */
function catalogImage(data: Record<string, unknown>): string {
  const images = data.images as Record<string, unknown> | undefined;
  return promptImageUrl(images, textOf(images?.full));
}

/** The catalog's photos as the contact sheets show them, labeled with the name the prompt uses. */
export function catalogSheetPhotos(photos: CatalogPhoto[]): ContactSheetPhoto[] {
  return photos.map((photo) => ({ label: catalogName(photo.path), url: catalogImage(photo.data) }));
}

/** "landscape", "portrait" or "square" from the photo's size, or "" when it isn't known. */
function orientation(data: Record<string, unknown>): string {
  const { width, height } = data;
  if (typeof width !== "number" || typeof height !== "number" || !width || !height) return "";
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

/** Where the photo was taken, such as "Busan, South Korea", the custom city and country first. */
function where(data: Record<string, unknown>): string {
  const city = textOf(data.customCity) || textOf(data.city);
  const country = textOf(data.customCountry) || textOf(data.country);
  return [city, country].filter(Boolean).join(", ");
}

/** One photo's line of the catalog: its name, tile, link, and what's known about it. */
function catalogLine(photo: CatalogPhoto, index: number, sheets?: ContactSheet[]): string {
  const { data } = photo;
  const facts = [
    textOf(data.title) && `title "${textOf(data.title)}"`,
    takenDay(data) && `taken ${takenDay(data)}`,
    where(data),
    orientation(data),
  ].filter(Boolean);
  const about = facts.length > 0 ? ` (${facts.join("; ")})` : "";
  return `- "${catalogName(photo.path)}"${tileNote(sheets, index)}: ${catalogImage(data)}${about}`;
}

/** The book's page layouts as the prompt lists them, one per line with how many photos each holds. */
function layoutLines(): string {
  return LAYOUTS.map(
    (layout) => `- "${layout.id}": ${layout.label}. ${layout.description} Holds ${layout.slots}.`,
  ).join("\n");
}

/** What the prompt says the catalog covers. */
function datesNote({ from, to }: CatalogDates): string {
  if (from && to) return ` It lists only photos taken from ${from} to ${to}.`;
  if (from) return ` It lists only photos taken on or after ${from}.`;
  if (to) return ` It lists only photos taken on or before ${to}.`;
  return "";
}

/** What the old book is sent to the LLM as: a PDF of it, or pictures of its pages or spreads. */
export type BookSource = "pdf" | "images";

/** The prompt's first paragraph: what's attached, and what to do with it. */
const SOURCE_INTRO: Record<BookSource, string> = {
  pdf: "The PDF attached is a photo book I made before.",
  images:
    "The images attached are the pages of a photo book I made before, in order: screenshots, scans or photos of them. An image that shows two pages side by side, with the spine down the middle, is two pages: the left one, then the right one.",
};

/** How the prompt says to count pages. */
const PAGE_NUMBERS: Record<BookSource, string> = {
  pdf: '"page" is the PDF\'s page number, counting from 1.',
  images:
    '"page" is the page\'s number in the book, counting from 1 through the images in order, two for each image of a spread.',
};

/** What the Import Book prompt is made from. */
export interface BookImportPromptInput {
  source: BookSource;
  photos: CatalogPhoto[];
  dates: CatalogDates;
  sheets?: ContactSheet[];
}

/**
 * The Import Book prompt: sent to an LLM with a PDF of a photo book made before, or images of its pages, it asks which of
 * the book's photos aren't on the website, and for each page's layout, title and photos (with their
 * captions), matched to the website's photos by name, as JSON the Import Book page reads.
 */
export function bookImportPrompt(input: BookImportPromptInput): string {
  const { source, photos, dates, sheets } = input;
  const look = lookAtPhotos(
    sheets,
    "Open each photo's link to see it; they're small versions, quick to look at.",
  );
  return `${SOURCE_INTRO[source]} Go through it page by page and match each photo printed in it to one of my website's photos, listed below, so the book can be rebuilt in my photo book planner.

## The website's photos

There are ${photos.length} photos in the catalog, oldest first.${datesNote(dates)} Each is named in quotes, which is the name to answer with.

${look}

${photos.map((photo, i) => catalogLine(photo, i, sheets)).join("\n")}

## Page layouts

Each page of the planner has one of these layouts:
${layoutLines()}

## What to do

1. For every page of the book with at least one photo, pick the layout that's closest to how the page looks: the same number of photos, on the same side, in the same orientation. When a printed page has more photos than any layout holds, split it into pages that follow one another, in reading order. Leave out pages with no photos, such as the cover, a title page or a page of text only.
2. Put the page's photos in the order the layout places them, top to bottom.
3. Match each printed photo to a website photo by what it shows: the same scene, framing and moment, allowing for a different crop, edit or black and white. A printed title, place and date that match the catalog's help, but the picture decides. Only match a photo you're confident about; a similar shot of the same place isn't a match.
4. A printed photo that isn't any of the website's photos gets "photo": "" and a short description under "description", and is also listed under "notOnWebsite".
5. Give each photo's printed title under "printedTitle" (the bold first line of its caption), or null. Its "caption" is null when the printed caption is only its title and facts (place, date, camera, settings), since my caption template writes those; otherwise copy the printed caption as it is. Copy a page's heading, such as "WINTER", as its "title", or null when it has none.
6. Suggest a name for the book (its title, if the cover has one) and one sentence describing it, for an album of its photos.

Answer with only this JSON, with nothing before or after it:
{
  "book": { "name": "the book's name", "description": "one sentence about the book" },
  "notOnWebsite": [
    { "page": 3, "printedTitle": "its printed title, or null", "description": "what the photo shows, so I can find it" }
  ],
  "pages": [
    {
      "page": 1,
      "layout": "one of the layouts' IDs above",
      "title": "the page's heading, or null",
      "photos": [
        { "photo": "a website photo's name, or \\"\\"", "printedTitle": "its printed title, or null", "caption": "the printed caption, or null", "description": "what the photo shows, when it isn't on the website" }
      ]
    }
  ]
}

${PAGE_NUMBERS[source]}`;
}
