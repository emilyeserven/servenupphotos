import type { BulkTagPhoto } from "@/api/bulk-tags";
import type { ContactSheet } from "@/api/contact-sheets";
import type { Place } from "@/api/places";
import { photoBasics, sheetsBlock } from "@/lib/bulk-tag-prompt";
import {
  type PastedLocation,
  PLACE_NAME_RULES,
  POSITION_RULES,
  describePlace,
  listed,
  readLocation,
} from "@/lib/location-prompt";
import { readPastedList } from "@/lib/pasted-json";
import { textOf } from "@portfolio/lib/values";

/**
 * One photo's part of the prompt: its name, its tile on the contact sheets when there are any, its
 * link, and what's known of where it was taken.
 */
function photoSection(
  photo: BulkTagPhoto,
  places: Place[],
  index: number,
  sheets?: ContactSheet[],
): string {
  const { heading, known } = photoBasics(photo, places, index, sheets);
  return `${heading}
What's already known about it:
${listed(known, "- Nothing yet.")}`;
}

/**
 * The prompt to paste into a chat with an LLM, asking where each photo was taken, with a link to the
 * place on a map to check it by, and for the answer as JSON that `parseBulkPlaceAnswer` reads. With
 * contact sheets, it links them and asks the LLM to start with them.
 */
export function bulkPlacePrompt(
  photos: BulkTagPhoto[],
  places: Place[],
  sheets?: ContactSheet[],
): string {
  const existing = places.map((place) => `- ${describePlace(place)}`);
  return `Work out the place where each of these ${photos.length} photos was taken. They were picked to go together, so several may share a place.

It's for a photography portfolio, which shows each photo's place, city and country, and puts it on a map. A place is somewhere more exact than a city, such as a building, temple, park, market, station, bridge or viewpoint.
${sheetsBlock(sheets)}
${photos.map((photo, i) => photoSection(photo, places, i, sheets)).join("\n\n")}

Rules:
- Look each place up on a map to check it's the place and where it is: Google Maps, or for a place in South Korea, Naver Map or Kakao Map, which show much more there than Google Maps does. Put the link to the place on that map in "mapUrl", or "" when you can't link to it.
- Trust what's already known unless the photo clearly contradicts it, and say so in "reasoning" when it does.
- Name the most specific place you can recognize. If it's one of the existing places listed below, spell it exactly as it's listed. Give photos taken at the same place the same name, spelled the same way.
- "wikidata" is the place's Wikidata item ID, such as "Q1490", for an item that is this exact place (not its city or a similar place). Look it up on wikidata.org to check it; "" when there isn't one or you aren't sure. It's only used to fetch the place's outline from OpenStreetMap, so never give coordinates for the outline yourself.
- "parent" is an existing place, spelled exactly as it's listed, that the place is in, such as Gyeongbokgung Palace for Geunjeongmun Gate; or "" for none.
${PLACE_NAME_RULES}
${POSITION_RULES}
- Answer with only this JSON, with nothing before or after it, and every photo listed once by its name in quotes above:
{
  "photos": [
    { "photo": "the photo's name", "place": "", "parent": "", "relation": "", "city": "", "state": "", "country": "", "latitude": null, "longitude": null, "exact": false, "mapUrl": "", "wikidata": "", "confidence": "", "reasoning": "" }
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
  /** The place's Wikidata item ID, such as "Q1490", when the answer gives one; otherwise "". */
  wikidata: string;
}

/** value when it's a Wikidata item ID such as "Q1490", in capitals, or else "". */
function wikidataId(value: unknown): string {
  const id = textOf(value).toUpperCase();
  return /^Q\d+$/.test(id) ? id : "";
}

/** url when it's an http or https link, or else "". */
function webLink(value: unknown): string {
  const url = textOf(value);
  return /^https?:\/\/\S+$/i.test(url) ? url : "";
}

/** One photo in the answer, or null when it doesn't name the photo. */
function readPhoto(value: unknown): PastedPhotoPlace | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const photo = textOf(item.photo).replace(/\.json$/i, "");
  if (!photo) return null;
  return {
    ...readLocation(item),
    photo,
    parent: textOf(item.parent),
    mapUrl: webLink(item.mapUrl),
    wikidata: wikidataId(item.wikidata),
  };
}

/**
 * Each photo in the LLM's answer. Throws a sentence a user can read when it has no JSON object with
 * a list of photos.
 */
export function parseBulkPlaceAnswer(text: string): PastedPhotoPlace[] {
  return readPastedList(text, "photos").flatMap((value) => readPhoto(value) ?? []);
}
