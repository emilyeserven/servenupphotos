import type { BulkTagPhoto } from "@/api/bulk-tags";
import type { Group } from "@/api/organize";
import type { Place } from "@/api/places";
import { photoBasics, savedTags } from "@/lib/bulk-tag-prompt";

/** One photo's part of the prompt: its name and link, its title and where it was taken, and its tags. */
function photoSection(photo: BulkTagPhoto, places: Place[]): string {
  const { heading, known } = photoBasics(photo, places);
  const tags = savedTags(photo.data);
  if (tags.length > 0) known.push(`- Tags: ${tags.join(", ")}`);
  return `${heading}
${known.join("\n") || "- Nothing known yet."}`;
}

/** The genres the prompt offers, one "- Name: description" line each. */
function genreLines(genres: Group[]): string {
  const lines = genres
    .filter((genre) => !genre.error)
    .map((genre) => `- ${genre.name}${genre.description ? `: ${genre.description}` : ""}`);
  return lines.join("\n") || "- None yet.";
}

/**
 * The prompt to paste into a chat with an LLM, asking for the photographic genres of several
 * photos at once, from the genres there are, and for the answer as JSON the backend reads.
 */
export function genrePrompt(photos: BulkTagPhoto[], genres: Group[], places: Place[]): string {
  return `Suggest the photographic genres of each of these ${photos.length} photos.

The genres are for a photography portfolio, where visitors filter photos by genre: the kind of photography a photo is, such as Street, Landscape, Portrait or Architecture.

${photos.map((photo) => photoSection(photo, places)).join("\n\n")}

Genres there are already:
${genreLines(genres)}

Rules:
- Give each photo 1 to 3 genres, the ones that fit it best, most fitting first. Look at the photo itself; what's known about it is only to help.
- Use the genres there are already whenever one fits, spelled exactly as they're listed.
- Only when none of them fits a photo, suggest a new genre: a kind of photography photographers would recognize (such as Night, Food, Wildlife or Macro), never a subject, place or mood (not "cats", "Kyoto" or "calm"). Name it in Title Case, and describe it in "newGenres" in one sentence, once.
- Answer with only this JSON, with nothing before or after it, and every photo listed once by its name in quotes above:
{
  "photos": [
    { "photo": "the photo's name", "genres": ["Street", "Night"] }
  ],
  "newGenres": [
    { "genre": "Night", "description": "Photos taken after dark, lit by streetlights, signs or the moon." }
  ]
}
- Leave "newGenres" empty when every genre is one there is already.`;
}
