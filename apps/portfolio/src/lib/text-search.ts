import type { Photo } from "@portfolio/lib/photos";

/** The text search's key in the URL, such as `?q=seoul fujifilm`. */
export const TEXT_SEARCH_KEY = "q";

/** The text search from the URL, left out when it's empty or only spaces. */
export function parseTextSearch(search: Record<string, unknown>): { q?: string } {
  const value = search[TEXT_SEARCH_KEY];
  return typeof value === "string" && value.trim() !== "" ? { q: value } : {};
}

/**
 * Text as the search compares it: lowercase, with accents taken off Latin letters, so "sao paulo"
 * finds "São Paulo". Only the Latin combining marks go, so Japanese and Korean text stays as it is.
 */
function normalized(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Every way the photo's location is written: each script's label and parts, and the English names. */
function locationTexts(photo: Photo): (string | null)[] {
  const written = Object.values(photo.location ?? {}).flatMap(({ label, parts }) => [
    label,
    parts.specific,
    parts.places,
    parts.city,
    parts.state,
    parts.country,
  ]);
  return [...written, photo.country, photo.state, photo.city];
}

/** The text each photo is searched by, worked out once per photo. */
const searchTexts = new WeakMap<Photo, string>();

/** What the search looks through for a photo: its title, location and camera model. */
function searchText(photo: Photo): string {
  const cached = searchTexts.get(photo);
  if (cached !== undefined) return cached;
  const texts = [photo.title, photo.camera, ...locationTexts(photo)];
  const text = normalized(texts.filter(Boolean).join("\n"));
  searchTexts.set(photo, text);
  return text;
}

/** The search's words, each of which a photo has to match. */
function searchWords(query: string): string[] {
  return normalized(query).split(/\s+/).filter(Boolean);
}

/**
 * The photos whose title, location or camera model has every word of the search somewhere in it,
 * in the same order; all of them when there's no search. "seoul x-t5" finds the photos taken in
 * Seoul on an X-T5.
 */
export function searchPhotos<T extends Photo>(list: T[], query: string | undefined): T[] {
  const words = searchWords(query ?? "");
  if (words.length === 0) return list;
  return list.filter((photo) => {
    const text = searchText(photo);
    return words.every((word) => text.includes(word));
  });
}
