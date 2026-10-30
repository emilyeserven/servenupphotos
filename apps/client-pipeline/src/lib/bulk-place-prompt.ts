import type { BulkTagPhoto } from "@/api/bulk-tags";
import type { Place } from "@/api/places";
import { savedDetails, savedExifPlace } from "@/components/photo-details";
import {
  type PastedLocation,
  PLACE_NAME_RULES,
  POSITION_RULES,
  describePlace,
  jsonObject,
  knownLines,
  listed,
  readLocation,
  str,
} from "@/lib/location-prompt";
import { promptImageUrl } from "@/lib/tag-prompt";

/** One photo's part of the prompt: its name and link, and what's known of where it was taken. */
function photoSection(photo: BulkTagPhoto, places: Place[]): string {
  const { data } = photo;
  const known = knownLines({ details: savedDetails(data), exif: savedExifPlace(data), places });
  const url = promptImageUrl(data.images as Record<string, unknown> | undefined, "");
  return `Photo "${photo.name}": ${url}
What's already known about it:
${listed(known, "- Nothing yet.")}`;
}

/**
 * The prompt to paste into a chat with an LLM, asking where each photo was taken, with a link to the
 * place on a map to check it by, and for the answer as JSON that `parseBulkPlaceAnswer` reads.
 */
export function bulkPlacePrompt(photos: BulkTagPhoto[], places: Place[]): string {
  const existing = places.map((place) => `- ${describePlace(place)}`);
  return `Work out the place where each of these ${photos.length} photos was taken. They were picked to go together, so several may share a place.

It's for a photography portfolio, which shows each photo's place, city and country, and puts it on a map. A place is somewhere more exact than a city, such as a building, temple, park, market, station, bridge or viewpoint.

${photos.map((photo) => photoSection(photo, places)).join("\n\n")}

Rules:
- Look each place up on a map to check it's the place and where it is: Google Maps, or for a place in South Korea, Naver Map or Kakao Map, which show much more there than Google Maps does. Put the link to the place on that map in "mapUrl", or "" when you can't link to it.
- Trust what's already known unless the photo clearly contradicts it, and say so in "reasoning" when it does.
- Name the most specific place you can recognize. If it's one of the existing places listed below, spell it exactly as it's listed. Give photos taken at the same place the same name, spelled the same way.
- "parent" is an existing place, spelled exactly as it's listed, that the place is in, such as Gyeongbokgung Palace for Geunjeongmun Gate; or "" for none.
${PLACE_NAME_RULES}
${POSITION_RULES}
- Answer with only this JSON, with nothing before or after it, and every photo listed once by its name in quotes above:
{
  "photos": [
    { "photo": "the photo's name", "place": "", "parent": "", "relation": "", "city": "", "state": "", "country": "", "latitude": null, "longitude": null, "exact": false, "mapUrl": "", "confidence": "", "reasoning": "" }
  ]
}

Existing places:
${listed(existing, "- None yet.")}`;
}

/** Where the LLM says one photo was taken, as read from its answer. */
export interface PastedPhotoPlace extends PastedLocation {
  /** The photo's name, as the prompt called it. */
  photo: string;
  /** The existing place the answer says the place is in, or "". */
  parent: string;
  /** The answer's link to the place on a map, when it's a web link; otherwise "". */
  mapUrl: string;
}

/** url when it's an http or https link, or else "". */
function webLink(value: unknown): string {
  const url = str(value);
  return /^https?:\/\/\S+$/i.test(url) ? url : "";
}

/** One photo in the answer, or null when it doesn't name the photo. */
function readPhoto(value: unknown): PastedPhotoPlace | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const photo = str(item.photo).replace(/\.json$/i, "");
  if (!photo) return null;
  return { ...readLocation(item), photo, parent: str(item.parent), mapUrl: webLink(item.mapUrl) };
}

/** Each photo in the LLM's answer, or null when it has no JSON object with a list of photos. */
export function parseBulkPlaceAnswer(text: string): PastedPhotoPlace[] | null {
  const photos = jsonObject(text)?.photos;
  if (!Array.isArray(photos)) return null;
  return photos.flatMap((value) => readPhoto(value) ?? []);
}
