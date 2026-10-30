import { localizationId, type Place } from "@/api/places";
import { FIELDS, savedFields } from "@/components/localization-row";
import type { LocalizationRow } from "@/lib/place-seeds";

/** Whether a row still needs its romanization or local script: the two every name has. */
function needsLocalization(row: LocalizationRow): boolean {
  const saved = savedFields(row.saved);
  return !saved.romanization.trim() || !saved.localScript.trim();
}

/** The rows that need filling in, the ones the most photos show first. */
export function rowsToFill(rows: LocalizationRow[]): LocalizationRow[] {
  return rows.filter(needsLocalization).toSorted((a, b) => b.photos - a.photos);
}

/** Where a place is, such as "Seoul, South Korea", from its own city, state and country. */
function placeWhere(row: LocalizationRow, places: Place[]): string {
  const place = places.find((p) => localizationId("place", p.name, p.id) === row.id);
  return [...new Set([place?.city, place?.state, place?.country].filter(Boolean))].join(", ");
}

/** Where the row's name is: a place's city and country, or a city's state or country. */
function where(row: LocalizationRow, places: Place[]): string {
  return row.type === "place" ? placeWhere(row, places) : row.detail;
}

/** The fields already saved for a row, such as ` Already saved: local script "경복궁".` */
function alreadySaved(row: LocalizationRow): string {
  const saved = savedFields(row.saved);
  const kept = FIELDS.filter(({ key }) => saved[key].trim()).map(
    ({ key, label }) => `${label.toLowerCase()} "${saved[key].trim()}"`,
  );
  return kept.length > 0 ? `. Already saved: ${kept.join(", ")}` : "";
}

/** One row as a line of the prompt, such as `- [city-seoul] city "Seoul", in South Korea`. */
function rowLine(row: LocalizationRow, places: Place[]): string {
  const at = where(row, places);
  return `- [${row.id}] ${row.type} "${row.name}"${at ? `, in ${at}` : ""}${alreadySaved(row)}`;
}

/**
 * The prompt to paste into a chat with an LLM, asking how each row's name is written and said where
 * it is, and for the answer as JSON that `readLocalizationAnswer` reads.
 */
export function localizationPrompt(rows: LocalizationRow[], places: Place[]): string {
  return `Fill in how each of these ${rows.length} countries, states, cities and places is written and said where it is.

They're for a photography portfolio that can show every place name in English, romanized, phonetically, or in its local script. Each line is one name: its ID in brackets, what kind of name it is, the name in English, where it is, and any fields already saved.

${rows.map((row) => rowLine(row, places)).join("\n")}

For each name, give:
- "romanization": the local name in Latin letters, the way it's officially romanized there: Revised Romanization for Korean, modified Hepburn with macrons for Japanese, Hanyu Pinyin with tone marks for Mandarin, such as "Gyeongbokgung", "Tōkyō" or "Běijīng". Romanize the local name, not the English one: "Gyeongbokgung", not "Gyeongbokgung Palace". For a language written in Latin letters, it's the local name as written there, such as "München".
- "pronunciation": how the local script is read, in the local phonetic script, only when the local script doesn't already show it: hiragana for Japanese kanji, such as "とうきょう" for "東京", or bopomofo for Chinese characters. Otherwise "", as for hangeul or a language written in Latin letters.
- "localScript": the name as it's written there, in its own script, such as "경복궁", "東京" or "München".

Rules:
- Keep the fields already saved exactly as they are.
- When you don't know a name's local form for certain, give "" for that field rather than guessing.
- Answer with only this JSON, with nothing before or after it, and every name listed once by its ID in brackets above:
{
  "localizations": [
    { "id": "city-seoul", "romanization": "Seoul", "pronunciation": "", "localScript": "서울" }
  ]
}`;
}
