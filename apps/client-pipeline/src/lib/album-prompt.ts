import type { BulkTagPhoto } from "@/api/bulk-tags";
import type { MetaGroup } from "@/api/metainfo";
import { type Group, albumTree, groupLabel } from "@/api/organize";
import type { Place } from "@/api/places";
import { savedDetails, savedExifPlace } from "@/components/photo-details";
import { photoLink, savedList } from "@/lib/bulk-tag-prompt";
import { knownLines } from "@/lib/location-prompt";

/** What the album prompt tells the LLM about: the albums to reuse, and the names that are taken. */
export interface AlbumPromptLists {
  albums: Group[];
  tags: Group[];
  genres: Group[];
  metaGroups: MetaGroup[];
}

/** When the photo was taken, the hand-written date over the EXIF one, or "" when neither is set. */
function takenDate(data: Record<string, unknown>): string {
  const custom = data.customCreateDate;
  if (typeof custom === "string" && custom !== "") return custom;
  return typeof data.createDate === "string" ? data.createDate : "";
}

/** ids as the prompt lists them, or "none". */
function listed(ids: string[]): string {
  return ids.length > 0 ? ids.join(", ") : "none";
}

/** One photo's part of the prompt: its name and link, what's known of it, its date, tags and genres. */
function photoSection(photo: BulkTagPhoto, places: Place[]): string {
  const { data } = photo;
  const known = knownLines({ details: savedDetails(data), exif: savedExifPlace(data), places });
  return `Photo "${photo.name}": ${photoLink(data)}
What's already known about it:
${known.join("\n") || "- Nothing yet."}
- Taken: ${takenDate(data) || "unknown"}
Tags: ${listed(savedList(data, "tags"))}
Genres: ${listed(savedList(data, "genres"))}`;
}

/** Every album as the prompt lists it, each under its parent, with its description. */
function albumLines(albums: Group[]): string {
  const rows = albumTree(albums.filter((album) => !album.error)).map(({ group, depth }) => {
    const about = group.description ? `: ${group.description}` : "";
    return `${"  ".repeat(depth)}- ${groupLabel(group)}${about}`;
  });
  return rows.length > 0 ? rows.join("\n") : "- None yet.";
}

/** The tag, genre and metadata group names, which an album can't be named. */
function takenNames({ tags, genres, metaGroups }: AlbumPromptLists): string {
  const names = [
    ...tags.filter((tag) => !tag.error).map(groupLabel),
    ...genres.filter((genre) => !genre.error).map(groupLabel),
    ...metaGroups.map((group) => group.name),
  ];
  return listed(names);
}

/**
 * The prompt to paste into a chat with an LLM, asking which albums, existing or new, several photos
 * picked to go together belong in, and for the answer as JSON the backend reads.
 */
export function albumPrompt(
  photos: BulkTagPhoto[],
  lists: AlbumPromptLists,
  places: Place[],
): string {
  return `Suggest albums for these ${photos.length} photos, which were picked to go together.

The albums are for a photography portfolio. An album gathers photos that make a set worth browsing on its own, such as one trip, one place or one theme, like "Kyoto in Autumn", "Night Markets of Taipei" or "Seoul Cafés". A photo is usually in only one album, and albums can sit inside other albums, such as a city's album inside its country's.

${photos.map((photo) => photoSection(photo, places)).join("\n\n")}

Rules:
- Group photos that share tags first. Otherwise, group photos taken in the same place around the same dates, such as on one trip.
- Reuse an existing album (listed below) whenever one fits, naming it exactly as it is listed.
- Suggest a new album only when at least two of these photos fit it, or when it's clearly the start of a set worth adding to. Name it the way a visitor would see it, in title case, such as "Busan Beaches"; keep it under 60 characters, and don't use any of the names under "Names that are taken".
- Put a new album inside an existing one when that album is a more general home for it, such as a country's album for a trip there: set "parent" to that album's name, or to "" for none.
- Put each photo in one album at most, and leave out a photo that doesn't fit any.
- Answer with only this JSON, with nothing before or after it, naming each photo by its name in quotes above:
{
  "albums": [
    {
      "album": "an existing album's name, or the new album's name",
      "description": "one sentence about a new album, or \\"\\" for an existing one",
      "parent": "the existing album a new one goes inside, or \\"\\"",
      "photos": ["the photo's name"]
    }
  ]
}

Existing albums:
${albumLines(lists.albums)}

Names that are taken: ${takenNames(lists)}`;
}
