import type { BulkPlaces, BulkPlacesPhoto } from "@/api/bulk-places";
import type { BulkTagPhoto } from "@/api/bulk-tags";
import { type PhotoPlace, type Place, entryId } from "@/api/places";
import type { PastedPhotoPlace } from "@/lib/bulk-place-prompt";
import { type MapSearch, googleMapsUrl, placeSearch } from "@/lib/google-maps";
import { findPlace, newPlace } from "@/lib/location-prompt";
import { gpsText, writtenPosition } from "@/lib/place-gps";
import { placeCity, withParent } from "@/lib/place-hierarchy";

/** What the pasted answer gives one picked photo. */
export interface BulkPlacePlan {
  photo: BulkTagPhoto;
  /** The answer for the photo, or undefined when it doesn't name it. */
  pasted?: PastedPhotoPlace;
  /** The place the answer gives it, existing or new; undefined when it gives none. */
  place?: Place;
  /** The photo's places once saved, the most specific first: the place, and the place it's in. */
  rows: PhotoPlace[];
  /** The city and country written in by hand from its places, where the photo shows none; "" otherwise. */
  customCity: string;
  customCountry: string;
}

/** What pasting the answer would do: the places each photo gets and the new places to make. */
export interface BulkPlacesReview {
  plans: BulkPlacePlan[];
  /** The places the answer names that aren't places yet, each once. */
  newPlaces: Place[];
  /** Photos the answer names that aren't any of the picked ones. */
  unknown: string[];
  /** Every place's name, the new ones too, by ID. */
  names: Record<string, string>;
}

/** A new place for the pasted one, in the existing place the answer says it's in, when it's one. */
function madePlace(pasted: PastedPhotoPlace, places: Place[]): Place {
  const place = newPlace(pasted);
  const parent = findPlace(pasted.parent, places)?.id ?? "";
  return { ...place, parent: parent === place.id ? "" : parent };
}

/** Whether the pasted place is one there isn't yet. */
function isNewPlace(pasted: PastedPhotoPlace, places: Place[]): boolean {
  return entryId(pasted.place) !== "" && !findPlace(pasted.place, places);
}

/** The places the answer names that aren't places yet, each once, as the first photo naming it has it. */
function newPlaces(answer: PastedPhotoPlace[], places: Place[]): Place[] {
  const made = answer
    .filter((pasted) => isNewPlace(pasted, places))
    .map((pasted) => madePlace(pasted, places));
  return made.filter((place, i) => made.findIndex((p) => p.id === place.id) === i);
}

/** text when the photo shows nothing for the field yet (neither by hand nor from its EXIF), or else "". */
function writeIn(data: Record<string, unknown>, field: "city" | "country", text: string): string {
  const custom = field === "city" ? data.customCity : data.customCountry;
  const shown = [custom, data[field]].some((value) => typeof value === "string" && value.trim());
  return shown ? "" : text;
}

/** The place the answer gives the photo, from every place, the new ones too. */
function answerPlace(pasted: PastedPhotoPlace | undefined, all: Place[]): Place | undefined {
  return pasted?.place ? findPlace(pasted.place, all) : undefined;
}

/** The photo's places once saved, and the city and country written in where it shows none. */
function placed(photo: BulkTagPhoto, relation: string, place: Place, all: Place[]) {
  const rows = withParent([{ relation, id: place.id }], 0, all);
  const where = placeCity(rows, all) ?? { city: "", country: "" };
  const customCity = writeIn(photo.data, "city", where.city);
  const customCountry = writeIn(photo.data, "country", where.country);
  return { place, rows, customCity, customCountry };
}

/** One picked photo's plan from its answer, given every place, the new ones too. */
function photoPlan(photo: BulkTagPhoto, pasted: PastedPhotoPlace | undefined, all: Place[]) {
  const place = answerPlace(pasted, all);
  const none: BulkPlacePlan = { photo, pasted, rows: [], customCity: "", customCountry: "" };
  return place ? { ...none, ...placed(photo, pasted?.relation ?? "", place, all) } : none;
}

/** The review of the answer for the picked photos, given the places there are now. */
export function reviewBulkPlaces(
  photos: BulkTagPhoto[],
  answer: PastedPhotoPlace[],
  places: Place[],
): BulkPlacesReview {
  const made = newPlaces(answer, places);
  const all = [...places, ...made];
  const byName = new Map(answer.map((pasted) => [pasted.photo.toLowerCase(), pasted]));
  const names = new Set(photos.map((photo) => photo.name.toLowerCase()));
  return {
    plans: photos.map((photo) => photoPlan(photo, byName.get(photo.name.toLowerCase()), all)),
    newPlaces: made,
    unknown: answer.map((pasted) => pasted.photo).filter((name) => !names.has(name.toLowerCase())),
    names: Object.fromEntries(all.map((place) => [place.id, place.name || place.id])),
  };
}

/** Whether the plan's photo starts ticked: it has a place the LLM isn't unsure of. */
export function tickedAtFirst(plan: BulkPlacePlan): boolean {
  return plan.place !== undefined && plan.pasted?.confidence !== "low";
}

/** The plan as Bulk Places saves it. */
function photoToSave(plan: BulkPlacePlan): BulkPlacesPhoto {
  const { photo, rows, customCity, customCountry } = plan;
  return { path: photo.path, places: rows, customCity, customCountry };
}

/** What saving the ticked photos sends: their places, and the new places they use. */
export function bulkPlacesToSave(
  review: BulkPlacesReview,
  ticked: ReadonlySet<string>,
): BulkPlaces {
  const plans = review.plans.filter((p) => p.place && ticked.has(p.photo.path));
  const used = new Set(plans.flatMap((p) => p.rows.map((row) => row.id)));
  return {
    newPlaces: review.newPlaces.filter((place) => used.has(place.id)),
    photos: plans.map(photoToSave),
  };
}

/** Where a place is, such as "Seoul, South Korea · 37.57, 127.0098 (exact)", or that it's not given. */
export function whereText(place: Place): string {
  const region = [place.city, place.state, place.country].filter(Boolean).join(", ");
  const gps = gpsText(place);
  const position = gps && `${gps} (${place.exactLocation ? "exact" : "approximate"})`;
  return [region, position].filter(Boolean).join(" · ") || "Nowhere given";
}

/** The places as the photo would read, such as "at Geunjeongmun Gate in Gyeongbokgung Palace". */
export function placeLabel(plan: BulkPlacePlan, names: Record<string, string>): string {
  const [first, second] = plan.rows.map((row) => names[row.id] ?? row.id);
  return [plan.pasted?.relation, first, second && `in ${second}`].filter(Boolean).join(" ");
}

/** A link to the place's GPS position on Google Maps, when it has one. */
function gpsLink(place: Place): MapSearch[] {
  const position = writtenPosition(gpsText(place));
  return position ? [{ label: "GPS position on Google Maps", url: googleMapsUrl(position) }] : [];
}

/** The link to the place on a map that the answer gives, when it gives one. */
function answerLink(plan: BulkPlacePlan): MapSearch[] {
  const url = plan.pasted?.mapUrl ?? "";
  return url ? [{ label: "The answer's map link", url }] : [];
}

/** Links to check the place by: the answer's own map link, a map search, and its GPS position. */
export function mapLinks(plan: BulkPlacePlan, place: Place): MapSearch[] {
  return [
    ...answerLink(plan),
    placeSearch(place.name, place.city ?? "", place.country ?? ""),
    ...gpsLink(place),
  ];
}
