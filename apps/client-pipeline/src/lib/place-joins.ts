import { type PhotoPlace, type Place, RELATIONS } from "@/api/places";

/** The words a place can be joined to the place it's in with: the relations, and a comma. */
export const JOIN_WORDS = [...RELATIONS, ","] as const;

/** A join word as a menu shows it, with the comma named. */
export function joinLabel(word: string): string {
  return word === "," ? ", (comma)" : word;
}

function byId(places: Place[], id: string | undefined): Place | undefined {
  return id ? places.find((place) => place.id === id) : undefined;
}

/** The word places in this one are joined to it with, unless they set their own: "in" by default. */
export function childJoin(parent: Place | undefined): string {
  return parent?.childRelation || "in";
}

/**
 * The word a place is joined to the place it's in with, such as "in" or ",": its own, or else its
 * parent's default for the places in it, or else "in".
 */
function joinWord(place: Place, places: Place[]): string {
  return place.parentRelation || childJoin(byId(places, place.parent));
}

/** The place and every place it's in, nearest first, stopping where a loop of parents comes back round. */
function chainUp(start: Place | undefined, places: Place[]): Place[] {
  const chain: Place[] = [];
  for (let at = start; at && !chain.includes(at); at = byId(places, at.parent)) chain.push(at);
  return chain;
}

/**
 * The word from the places for row `index`, when its place is one the place in the row before is
 * in, at any depth: the word of the place just under it on the way up. Undefined otherwise, so the
 * row keeps its own relation.
 */
export function placesJoin(rows: PhotoPlace[], index: number, places: Place[]): string | undefined {
  const chain = rowChain(rows, index, places);
  const at = chain.findIndex((place) => place.id === rows[index]?.id);
  return at > 0 ? chain.slice(at - 1, at).map((below) => joinWord(below, places))[0] : undefined;
}

/** The place in the row before `index` and every place it's in; none for the first row. */
function rowChain(rows: PhotoPlace[], index: number, places: Place[]): Place[] {
  return index > 0 ? chainUp(byId(places, rows[index - 1]?.id), places) : [];
}

/** The word before each row's place: from the places when it's one the place before is in, else the row's own. */
function rowWords(rows: PhotoPlace[], places: Place[]): string[] {
  return rows.map((row, index) => placesJoin(rows, index, places) ?? row.relation);
}

/** One place after the text before it: ", Queens" after a comma, else " in Queens". */
function joined(text: string, word: string, name: string): string {
  if (word === ",") return `${text}, ${name}`;
  return [text, word, name].filter(Boolean).join(" ");
}

/**
 * The photo's places as a phrase, such as "In Gyeongbokgung Palace by Geunjeongmun Gate" or "In
 * Astoria, Queens", naming each by its place's name, or its ID when it isn't a place.
 */
export function placePhrase(
  rows: PhotoPlace[],
  places: Place[],
  names: ReadonlyMap<string, string>,
): string {
  const words = rowWords(rows, places);
  const phrase = rows.reduce(
    (text, row, index) =>
      row.id ? joined(text, words[index] ?? "", names.get(row.id) ?? row.id) : text,
    "",
  );
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
