import { promptImageUrl } from "@/lib/tag-prompt";

/** How many photos the style prompt links until another number is chosen. */
export const defaultStyleCount = 30;

/** A photo the style prompt can link: its file's path and its JSON. */
export interface StylePhoto {
  path: string;
  data: Record<string, unknown>;
}

/** The typed count as a whole number of 1 or more, with no upper limit, or the default when it isn't one. */
export function styleCount(typed: string): number {
  const count = Math.round(Number(typed));
  return Number.isFinite(count) && count >= 1 ? count : defaultStyleCount;
}

/** The field's text, trimmed, or "" when it isn't text. */
function text(data: Record<string, unknown>, field: string): string {
  const value = data[field];
  return typeof value === "string" ? value.trim() : "";
}

/** The field's text values, such as a photo's genres. */
function texts(data: Record<string, unknown>, field: string): string[] {
  const value = data[field];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

/** The day the photo was taken as YYYY-MM-DD, the custom date first, or "" without one. */
export function takenDay(data: Record<string, unknown>): string {
  const date = text(data, "customCreateDate") || text(data, "createDate");
  return /^\d{4}[:-]\d{2}[:-]\d{2}/.test(date) ? date.slice(0, 10).replaceAll(":", "-") : "";
}

/** The country the photo was taken in, the custom one first, or "" without one. */
function country(data: Record<string, unknown>): string {
  return text(data, "customCountry") || text(data, "country");
}

/** Where the photo was taken, such as "Amsterdam, Netherlands", the custom city and country first. */
function where(data: Record<string, unknown>): string {
  const city = text(data, "customCity") || text(data, "city");
  return [city, country(data)].filter(Boolean).join(", ");
}

/** The camera settings as a photographer writes them, such as "35mm, f/1.8, 1/125s, ISO 200". */
function settings(data: Record<string, unknown>): string {
  const { focalLength, aperture, exposure, iso } = data;
  return [
    typeof focalLength === "number" && `${focalLength}mm`,
    typeof aperture === "number" && `f/${aperture}`,
    typeof exposure === "string" && exposure && `${exposure}s`,
    typeof iso === "number" && `ISO ${iso}`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** One fact as a line of the photo's part of the prompt, or no line when value is empty. */
function line(label: string, value: string): string[] {
  return value ? [`  - ${label}: ${value}`] : [];
}

/** One photo's part of the prompt: its link, then what's known of it, one fact per line. */
export function stylePhotoSection(photo: StylePhoto, place: number): string {
  const { data } = photo;
  const images = data.images as Record<string, unknown> | undefined;
  const full = typeof images?.full === "string" ? images.full : "";
  const gear = [text(data, "camera"), text(data, "lens")].filter(Boolean).join(" with ");
  return [
    `${place}. ${promptImageUrl(images, full)}`,
    ...line("Title", text(data, "title")),
    ...line("Taken", takenDay(data)),
    ...line("Where", where(data)),
    ...line("Gear", gear),
    ...line("Settings", settings(data)),
    ...line("Genres", texts(data, "genres").join(", ")),
    ...line("Tags", texts(data, "tags").join(", ")),
  ].join("\n");
}

/** A tiny seeded random number maker (mulberry32), so a shuffle can be shown again the same way. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Up to `count` of the photos, in their order. Without a seed they're spread evenly from the first
 * to the last, so a long span of time is covered from end to end; with one they're picked at random.
 */
export function samplePhotos<T>(photos: readonly T[], count: number, seed?: number): T[] {
  if (photos.length <= count) return [...photos];
  if (seed === undefined) {
    const step = photos.length / count;
    return Array.from({ length: count }, (_, i) => photos[Math.floor(i * step)] as T);
  }
  const random = seededRandom(seed);
  const places = photos.map((_, i) => i);
  for (let i = places.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [places[i], places[j]] = [places[j] as number, places[i] as number];
  }
  return places
    .slice(0, count)
    .toSorted((a, b) => a - b)
    .map((i) => photos[i] as T);
}

/** What the photos have in common, for the start of the prompt: their dates and countries. */
function span(photos: StylePhoto[]): string[] {
  const days = photos
    .map(({ data }) => takenDay(data))
    .filter(Boolean)
    .toSorted();
  const countries = [...new Set(photos.map(({ data }) => country(data)).filter(Boolean))];
  const first = days[0];
  const last = days.at(-1);
  return [
    ...(first && last ? [`- Taken from ${first} to ${last}`] : []),
    ...(countries.length > 0 ? [`- In ${countries.join(", ")}`] : []),
  ];
}

/**
 * How the style prompt asks for its answer: one Markdown note, with properties a notes app such as
 * Obsidian reads, so it can be saved as it is.
 */
function markdownAnswer({ focus, today }: Pick<StylePromptInput, "focus" | "today">): string {
  const question = focus.trim() ? ", plus one for my question" : "";
  return `Write your answer as one Markdown note I can save as it is in my notes (an Obsidian vault):
- Start with YAML front matter between --- lines, with: title, date (${today}), photos (how many you looked at), taken (the dates they span), places (a list of the countries), and tags (a list that includes photography-style and a few lowercase-kebab-case words for the style itself).
- Then a # heading with a short name for my style, and a ## heading for each of the points above, in that order${question}.
- When you point to a photo, link its number to its URL, such as [Photo 3](https://...).
- Use plain Markdown only: no tables, HTML or emoji.
- Put the whole note in one \`\`\`markdown code block, with nothing before or after it, so I can copy it.`;
}

/** What the style prompt is asked about. */
export interface StylePromptInput {
  /** The photos it links, in date order. */
  photos: StylePhoto[];
  /** How many photos the filters left, which the linked ones were picked from. */
  matching: number;
  /** Whether any of the portfolio Grid's filters narrowed the photos down. */
  filtered: boolean;
  /** What the photographer wants to hear about most, in their own words; "" for nothing. */
  focus: string;
  /** Today's date as YYYY-MM-DD, for the note's front matter. */
  today: string;
}

/** Where the linked photos came from, such as "30 of the 212 photos that match my filters". */
function pickedFrom({ photos, matching, filtered }: StylePromptInput): string {
  const of = filtered ? "photos that match the filters I chose" : "photos in my portfolio";
  if (photos.length >= matching) return `all ${matching} ${of}`;
  return `${photos.length} of the ${matching} ${of}, spread across them`;
}

/**
 * The prompt to paste into a chat with an LLM, asking it to describe the photographer's style from
 * the linked photos, with what's known of each one.
 */
export function stylePrompt(input: StylePromptInput): string {
  const focus = input.focus.trim();
  return `I'm a photographer. Please look at each of my photos at the links below and describe my photography style.

The photos are ${pickedFrom(input)}.
${span(input.photos).join("\n")}

Open every link and look at the photo itself; the facts listed under each one are only there to help. Then write about:
- My style overall, in a short paragraph, as you'd introduce me to someone who hasn't seen my work.
- The subjects and moments I'm drawn to.
- How I compose: framing, perspective, distance, and what I leave out.
- Light, color and tone, and how I edit.
- The gear and settings I lean on, and what they say about how I shoot.
- How my photos differ between the places and years here, if they do.
- What makes my photos recognizably mine, and one or two things I could try next.

Point to photos by their number when you give an example.${focus ? `\n\nMost of all, I'd like to know: ${focus}` : ""}

${markdownAnswer(input)}

${input.photos.map((photo, i) => stylePhotoSection(photo, i + 1)).join("\n\n")}`;
}
