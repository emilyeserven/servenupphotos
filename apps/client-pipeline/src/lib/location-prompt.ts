import { type Place, type PhotoPlace, entryId, RELATIONS } from "@/api/places";
import type { ExifPlace, PhotoDetails } from "@/components/photo-details";
import { gpsText, writtenPosition } from "@/lib/place-gps";
import { placeCity, withParent } from "@/lib/place-hierarchy";

/** What the location prompt tells the LLM about: what's already known of where the photo was taken. */
export interface LocationClues {
  /** The photo's details as they're being edited. */
  details: PhotoDetails;
  /** The city, state, country and GPS position from the photo's EXIF. */
  exif: ExifPlace;
  /** Every place in PLACES.json, to name the photo's places and to reuse when one fits. */
  places: Place[];
}

/** One known fact as a line of the prompt, on one line, or no line when value is empty. */
function line(label: string, value: string | null | undefined): string[] {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text ? [`- ${label}: ${text}`] : [];
}

/** The place's GPS position for the prompt, saying whether it's exactly where its photos were taken. */
function placeGps(place: Place): string {
  if (place.latitude === undefined || place.longitude === undefined) return "";
  const how = place.exactLocation ? "exactly where its photos are taken" : "approximate";
  return `GPS position ${place.latitude}, ${place.longitude} (${how})`;
}

/** A place as the prompt describes it: its name, where it is, and its GPS position. */
function describePlace(place: Place): string {
  const where = [...new Set([place.city, place.state, place.country].filter(Boolean))].join(", ");
  return [place.name || place.id, where && `in ${where}`, placeGps(place)]
    .filter(Boolean)
    .join(", ");
}

/** The photo's chosen places as lines of the prompt, such as "- Place: at Gyeongbokgung Palace, in Seoul". */
function placeLines(chosen: PhotoPlace[], places: Place[]): string[] {
  return chosen
    .filter((row) => row.id)
    .flatMap((row) => {
      const place = places.find((p) => p.id === row.id) ?? {
        id: row.id,
        name: "",
        description: "",
      };
      return line("Place", `${row.relation} ${describePlace(place)}`);
    });
}

/** The place name, when the photo has one without places; with places it's the first one's name. */
function placeNameLine(details: PhotoDetails): string[] {
  return details.places.some((row) => row.id) ? [] : line("Place name", details.placeName);
}

/** Everything already known of where the photo was taken, one fact per line, such as "- City from the EXIF: Cairo". */
export function knownLines({ details, exif, places }: LocationClues): string[] {
  return [
    ...line("Title", details.title),
    ...placeLines(details.places, places),
    ...placeNameLine(details),
    ...line("GPS position from the camera's EXIF (where the camera was)", exif.gpsPosition),
    ...line("GPS position written in by hand", details.customGpsPosition),
    ...line("City from the EXIF", exif.city),
    ...line("State or province from the EXIF", exif.state),
    ...line("Country from the EXIF", exif.country),
    ...line("City written in by hand", details.customCity),
    ...line("State or province written in by hand", details.customState),
    ...line("Country written in by hand", details.customCountry),
    ...line("Photographer's comment", details.comment),
  ];
}

/** lines as the prompt lists them, or `none` when there are none. */
function listed(lines: string[], none: string): string {
  return lines.length > 0 ? lines.join("\n") : none;
}

/** The prompt to paste into a chat with an LLM, asking where the photo at `imageUrl` was taken. */
export function locationPrompt(imageUrl: string, clues: LocationClues): string {
  const existing = clues.places.map((place) => `- ${describePlace(place)}`);
  return `Work out where the photo at this link was taken: ${imageUrl}

It's for a photography portfolio, which shows each photo's place, city, state or province and country, and puts it on a map.

What's already known about it:
${listed(knownLines(clues), "- Nothing yet.")}

Rules:
- Trust what's already known unless the photo clearly contradicts it, and say so in "reasoning" when it does.
- Name the most specific place you can recognize, such as a building, temple, park, station, bridge or viewpoint. If it's one of the existing places listed below, spell it exactly as it's listed.
- Write names as they're usually written in English, such as "Gyeongbokgung Palace", "Seoul" and "South Korea".
- Leave a name empty ("") rather than guess.
- "relation" is how the photo relates to the place, one of: ${RELATIONS.join(", ")}; or "" for none.
- "latitude" and "longitude" are in decimal degrees, where the photo was taken from. Give your best estimate even when you've only inferred the place or the area, such as the middle of the place, and set "exact" to false; use null only when you can't tell even roughly.
- "exact" is true only when that GPS position is where the photo was taken from to within about 50 meters, not just somewhere in the area.
- "confidence" is "high", "medium" or "low".
- "reasoning" is one or two sentences on what in the photo, or in what's known, gives the location away.
- Answer with only one JSON object in this shape, with nothing before or after it:

{"place": "", "relation": "", "city": "", "state": "", "country": "", "latitude": null, "longitude": null, "exact": false, "confidence": "", "reasoning": ""}

Existing places:
${listed(existing, "- None yet.")}`;
}

/** Where the LLM says the photo was taken, as read from its answer; "" for each field it left empty. */
export interface PastedLocation {
  place: string;
  /** One of RELATIONS, or "" for none or one that isn't. */
  relation: string;
  city: string;
  state: string;
  country: string;
  /** The GPS position as "latitude, longitude", or "" when there's none or it can't be read. */
  gps: string;
  /** Whether the LLM says the GPS position is where the photo was taken from, not just near it. */
  exact: boolean;
  confidence: string;
  reasoning: string;
}

/** The JSON object in the answer, from its first { to its last }, which skips a code fence or words around it. */
function jsonObject(text: string): Record<string, unknown> | null {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A coordinate the LLM gave as a number or as text, rounded to six places (about 10cm), or NaN. */
function coordinate(value: unknown): number {
  const number = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Math.round(number * 1e6) / 1e6;
}

/**
 * The answer's latitude and longitude as "latitude, longitude" in decimal degrees, also when it wrote
 * them in degrees, minutes and seconds (`37°34′12″N`); "" when they aren't a GPS position.
 */
function answerGps(answer: Record<string, unknown>): string {
  const decimal = `${coordinate(answer.latitude)}, ${coordinate(answer.longitude)}`;
  const text = writtenPosition(decimal)
    ? decimal
    : `${str(answer.latitude)} ${str(answer.longitude)}`;
  return gpsText(writtenPosition(text) ?? {});
}

/** The answer's relation, when it's one of RELATIONS. */
function answerRelation(value: unknown): string {
  const relation = str(value).toLowerCase();
  return (RELATIONS as readonly string[]).includes(relation) ? relation : "";
}

/** The location in the LLM's answer, or null when it has no JSON object to read. */
export function parseLocationAnswer(text: string): PastedLocation | null {
  const answer = jsonObject(text);
  if (!answer) return null;
  return {
    place: str(answer.place),
    relation: answerRelation(answer.relation),
    city: str(answer.city),
    state: str(answer.state),
    country: str(answer.country),
    gps: answerGps(answer),
    exact: answer.exact === true,
    confidence: str(answer.confidence).toLowerCase(),
    reasoning: str(answer.reasoning),
  };
}

/** A location field the pasted answer can fill. */
export type LocationField = "place" | "customCity" | "customState" | "customCountry" | "gps";

/** One change the pasted answer suggests, to tick or not. */
export interface LocationSuggestion {
  field: LocationField;
  label: string;
  /** What the photo shows there now, or "" for nothing. */
  current: string;
  suggested: string;
  /** Ticked from the start: the photo has nothing there yet. */
  ticked: boolean;
  /** What ticking it does besides, or how sure the LLM is of it. */
  note?: string;
}

function same(a: string, b: string | null): boolean {
  return a.toLowerCase() === (b ?? "").trim().toLowerCase();
}

/** The place in PLACES.json named name, or with the ID made from it, ignoring case. */
export function findPlace(name: string, places: Place[]): Place | undefined {
  return places.find((place) => same(name, place.name) || place.id === entryId(name));
}

/** What the photo's places are now, as they read: "at Gyeongbokgung Palace, in Seoul". */
function currentPlaces(details: PhotoDetails, places: Place[]): string {
  return details.places
    .filter((row) => row.id)
    .map((row) => `${row.relation} ${places.find((p) => p.id === row.id)?.name ?? row.id}`.trim())
    .join(", ");
}

/** Whether the photo already has the place. */
function alreadyHas(details: PhotoDetails, found: Place | undefined): boolean {
  return found !== undefined && details.places.some((row) => row.id === found.id);
}

/** The pasted place as it would read, such as "at Gyeongbokgung Palace", spelled as PLACES.json has it. */
function placeLabel(pasted: PastedLocation, found: Place | undefined): string {
  return `${pasted.relation} ${found?.name ?? pasted.place}`.trim();
}

const NEW_PLACE_NOTE =
  "Not a place yet: ticking it makes one, with the city, state, country and GPS position from the answer.";

/** The pasted place, unless there's none or the photo already has it. */
function placeSuggestion(pasted: PastedLocation, clues: LocationClues): LocationSuggestion[] {
  const found = findPlace(pasted.place, clues.places);
  if (!pasted.place || alreadyHas(clues.details, found)) return [];
  const current = currentPlaces(clues.details, clues.places);
  const note = found ? undefined : NEW_PLACE_NOTE;
  const suggested = placeLabel(pasted, found);
  return [{ field: "place", label: "Place", current, suggested, ticked: !current, note }];
}

/** What the photo shows: its custom value, or else the EXIF one, or "" for neither. */
function shown(custom: string, exif: string | null): string {
  return custom.trim() || exif || "";
}

type TextField = "customCity" | "customState" | "customCountry";

/** The labels of the custom fields, and the EXIF ones they show instead of. */
const TEXT_FIELDS: [TextField, string, keyof ExifPlace, keyof PastedLocation][] = [
  ["customCity", "City", "city", "city"],
  ["customState", "State or province", "state", "state"],
  ["customCountry", "Country", "country", "country"],
];

type TextFieldRow = (typeof TEXT_FIELDS)[number];

/**
 * The city, state or country the photo shows now: its custom one, or else the EXIF one, or else the
 * one its places give it (city and country only), or "" for none.
 */
function currentText({ details, exif, places }: LocationClues, row: TextFieldRow): string {
  const [field, , exifField, pastedField] = row;
  const fromPlaces: Record<string, string> = placeCity(details.places, places) ?? {};
  return shown(details[field], exif[exifField]) || fromPlaces[String(pastedField)] || "";
}

/** The pasted city, state or country, unless there's none or the photo already shows it. */
function textSuggestion(
  pasted: PastedLocation,
  clues: LocationClues,
  row: TextFieldRow,
): LocationSuggestion[] {
  const [field, label, , pastedField] = row;
  const suggested = String(pasted[pastedField]);
  const current = currentText(clues, row);
  if (!suggested || same(suggested, current)) return [];
  return [{ field, label, current, suggested, ticked: !current }];
}

/** What ticking the pasted GPS position replaces, or that it's only near where the photo was taken. */
function gpsNote(pasted: PastedLocation, exif: ExifPlace): string | undefined {
  if (exif.gpsPosition) return "Shown on the map instead of the camera's own GPS position.";
  return pasted.exact ? undefined : "The LLM says this is only near where it was taken.";
}

/** The pasted GPS position, unless there's none or the photo already has it. */
function gpsSuggestion(
  pasted: PastedLocation,
  { details, exif }: LocationClues,
): LocationSuggestion[] {
  const current = shown(details.customGpsPosition, exif.gpsPosition);
  if (!pasted.gps || pasted.gps === current) return [];
  // Offered, and ticked when the photo has none, even when the LLM only inferred roughly where it is.
  const note = gpsNote(pasted, exif);
  return [
    { field: "gps", label: "GPS position", current, suggested: pasted.gps, ticked: !current, note },
  ];
}

/** The changes the pasted answer suggests: only the fields where it says something new. */
export function locationSuggestions(
  pasted: PastedLocation,
  clues: LocationClues,
): LocationSuggestion[] {
  return [
    ...placeSuggestion(pasted, clues),
    ...TEXT_FIELDS.flatMap((field) => textSuggestion(pasted, clues, field)),
    ...gpsSuggestion(pasted, clues),
  ];
}

/** A new place file for the pasted place, with its city, state, country and GPS position. */
export function newPlace(pasted: PastedLocation): Place {
  const gps = writtenPosition(pasted.gps);
  const where = { city: pasted.city, state: pasted.state, country: pasted.country };
  const position = gps ? { ...gps, exactLocation: pasted.exact } : {};
  return { id: entryId(pasted.place), name: pasted.place, description: "", ...where, ...position };
}

/** The value a custom field takes: "" when it's what the EXIF says already, so the EXIF one shows. */
function customValue(suggested: string, exif: string | null): string {
  return same(suggested, exif) ? "" : suggested;
}

/** details with the place at placeId as the photo's place, with its parent after it when it has one. */
function withPlace(details: PhotoDetails, pasted: PastedLocation, place: Place, places: Place[]) {
  const rows = withParent([{ relation: pasted.relation, id: place.id }], 0, places);
  return { ...details, places: rows, placeName: place.name || place.id };
}

/** details with the ticked city, state and country filled in. */
function withTexts(clues: LocationClues, pasted: PastedLocation, ticked: Set<LocationField>) {
  const next = { ...clues.details };
  for (const [field, , exifField, pastedField] of TEXT_FIELDS) {
    if (ticked.has(field))
      next[field] = customValue(String(pasted[pastedField]), clues.exif[exifField]);
  }
  return next;
}

/**
 * details with the ticked suggestions filled in. `place` is the pasted place's file, found or just
 * made, when the place is ticked.
 */
export function withLocation(
  clues: LocationClues,
  pasted: PastedLocation,
  ticked: Set<LocationField>,
  place: Place | undefined,
): PhotoDetails {
  const texts = withTexts(clues, pasted, ticked);
  const gps = ticked.has("gps") ? pasted.gps : texts.customGpsPosition;
  const next = { ...texts, customGpsPosition: gps };
  return place ? withPlace(next, pasted, place, clues.places) : next;
}
