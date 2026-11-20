import type { BulkTagPhoto } from "@/api/bulk-tags";
import { type Group, albumTree } from "@/api/organize";
import type { ContactSheet } from "@/api/contact-sheets";
import type { Place } from "@/api/places";
import { photoWithTags as photoSection, sheetsBlock } from "@/lib/bulk-tag-prompt";

/**
 * The genres the prompt offers, one "- Name: description" line each, a subgenre's indented under
 * its genre.
 */
function genreLines(genres: Group[]): string {
  const lines = albumTree(genres.filter((genre) => !genre.error)).map(
    ({ group, depth }) =>
      `${"  ".repeat(depth)}- ${group.name}${group.description ? `: ${group.description}` : ""}`,
  );
  return lines.join("\n") || "- None yet.";
}

/** The names of the genres the photo has now, by their IDs in its JSON, or its IDs for unknown ones. */
function currentGenres(photo: BulkTagPhoto, genres: Group[]): string[] {
  const ids = Array.isArray(photo.data.genres) ? photo.data.genres : [];
  return ids
    .filter((id): id is string => typeof id === "string")
    .map((id) => genres.find((genre) => genre.id === id)?.name ?? id);
}

/** A photo's part of the prompt, with its genres now when they're being reassigned. */
function photoPart(
  photo: BulkTagPhoto,
  i: number,
  { genres, places, sheets, reassign }: GenrePromptOptions,
): string {
  const section = photoSection(photo, places, i, sheets);
  if (!reassign) return section;
  const now = currentGenres(photo, genres);
  return `${section}\n- Genres now: ${now.length > 0 ? now.join(", ") : "none"}`;
}

/** What the genre prompt is for, besides the photos. */
export interface GenrePromptOptions {
  /** Every genre there is, which the prompt lists with each subgenre under its genre. */
  genres: Group[];
  places: Place[];
  /** Contact sheets of the photos, which the prompt links and asks the LLM to start with. */
  sheets?: ContactSheet[];
  /**
   * True when the photos already have genres and the answer replaces them: the prompt shows each
   * photo's genres now and asks for the whole list again.
   */
  reassign?: boolean;
}

/** The opening ask: genres for photos without any, or a fresh look at the genres photos have. */
function promptAsk(count: number, reassign = false): string {
  return reassign
    ? `Look again at the photographic genres of each of these ${count} photos, and give each its genres as they should be. Each photo lists its genres now; keep the ones that fit, swap the ones that don't, and move a photo into a more specific subgenre where one fits.`
    : `Suggest the photographic genres of each of these ${count} photos.`;
}

/**
 * The prompt to paste into a chat with an LLM, asking for the photographic genres of several
 * photos at once, from the genres there are, and for the answer as JSON the backend reads. It can
 * suggest new genres, and new subgenres under a genre there is. With `reassign`, it shows each
 * photo's genres now and asks for the full list that replaces them. With contact sheets, it links
 * them and asks the LLM to start with them.
 */
export function genrePrompt(photos: BulkTagPhoto[], options: GenrePromptOptions): string {
  return `${promptAsk(photos.length, options.reassign)}

The genres are for a photography portfolio, where visitors filter photos by genre: the kind of photography a photo is, such as Street, Landscape, Portrait or Architecture. A genre can have subgenres, more specific kinds of it, such as Traditional architecture under Architecture; filtering by a genre shows its subgenres' photos too.
${sheetsBlock(options.sheets)}
${photos.map((photo, i) => photoPart(photo, i, options)).join("\n\n")}

Genres there are already:
${genreLines(options.genres)}

Rules:
- Give each photo 1 to 3 genres, the ones that fit it best, most fitting first. Look at the photo itself; what's known about it is only to help.${options.reassign ? " List every genre the photo should have, the ones it keeps too: the list replaces its genres." : ""}
- Use the genres there are already whenever one fits, spelled exactly as they're listed. A genre indented under another is a subgenre of it: when the subgenre fits, give the subgenre alone, since it already counts as its broader genre.
- Only when none of them fits a photo, suggest a new genre: a kind of photography photographers would recognize (such as Night, Food, Wildlife or Macro), never a subject, place or mood (not "cats", "Kyoto" or "calm"). Name it in Title Case, and describe it in "newGenres" in one sentence, once.
- When several photos share a more specific kind of a genre there is, which photographers would recognize (such as Traditional architecture or Brutalism under Architecture), suggest it as a new subgenre: give it in those photos' genres, and in "newGenres" name its broader genre in "parent", spelled as listed. Leave "parent" empty for a new top-level genre.
- Answer with only this JSON, with nothing before or after it, and every photo listed once by its name in quotes above:
{
  "photos": [
    { "photo": "the photo's name", "genres": ["Street", "Night"] }
  ],
  "newGenres": [
    { "genre": "Night", "parent": "", "description": "Photos taken after dark, lit by streetlights, signs or the moon." }
  ]
}
- Leave "newGenres" empty when every genre is one there is already.`;
}
