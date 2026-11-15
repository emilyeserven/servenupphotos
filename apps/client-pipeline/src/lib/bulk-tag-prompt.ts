import type { BulkTagPhoto } from "@/api/bulk-tags";
import type { ContactSheet, ContactSheetPhoto } from "@/api/contact-sheets";
import type { Place } from "@/api/places";
import { savedDetails, savedExifPlace } from "@/components/photo-details";
import { lookAtPhotos, tileNote } from "@/lib/contact-sheets";
import { knownLines } from "@/lib/location-prompt";
import { TAG_RULES, type TagPromptLists, promptImageUrl, tagListsSection } from "@/lib/tag-prompt";

/** The URL of the photo's full image, for when it has no Small or Medium version. */
function fullImage(data: Record<string, unknown>): string {
  const images = data.images as Record<string, unknown> | undefined;
  return typeof images?.full === "string" ? images.full : "";
}

/** The tags a photo already has, as its JSON lists them. */
export function savedTags(data: Record<string, unknown>): string[] {
  return Array.isArray(data.tags) ? data.tags.filter((tag) => typeof tag === "string") : [];
}

/** The image a prompt links for a picked photo: its Small version, else its Medium one, else its original. */
function photoImage(photo: BulkTagPhoto): string {
  const images = photo.data.images as Record<string, unknown> | undefined;
  return promptImageUrl(images, fullImage(photo.data));
}

/** The picked photos as the contact sheets show them, in the prompt's order, leaving none out. */
export function pickedSheetPhotos(photos: BulkTagPhoto[]): ContactSheetPhoto[] {
  return photos.map((photo) => ({ label: photo.name, url: photoImage(photo) }));
}

/**
 * The paragraph a prompt about picked photos puts before them asking the LLM to start with the
 * contact sheets, with a blank line on each side, or a single line break without sheets.
 */
export function sheetsBlock(sheets?: ContactSheet[]): string {
  const look = lookAtPhotos(sheets, "");
  return look ? `\n${look}\n` : "";
}

/**
 * The first line of a picked photo's part of a prompt, `Photo "name": link`, with its tile on the
 * contact sheets when there are any (`index` is its place in the prompt, from 0), and what's known
 * of it and where it was taken, one "- Label: value" line per fact.
 */
export function photoBasics(
  photo: BulkTagPhoto,
  places: Place[],
  index = 0,
  sheets?: ContactSheet[],
) {
  const { data } = photo;
  return {
    heading: `Photo "${photo.name}"${tileNote(sheets, index)}: ${photoImage(photo)}`,
    known: knownLines({ details: savedDetails(data), exif: savedExifPlace(data), places }),
  };
}

/**
 * One photo's part of a prompt that asks about each photo on its own, such as for its genres: its
 * name and link, its title and where it was taken, and its tags.
 */
export function photoWithTags(
  photo: BulkTagPhoto,
  places: Place[],
  index = 0,
  sheets?: ContactSheet[],
): string {
  const { heading, known } = photoBasics(photo, places, index, sheets);
  const tags = savedTags(photo.data);
  if (tags.length > 0) known.push(`- Tags: ${tags.join(", ")}`);
  return `${heading}
${known.join("\n") || "- Nothing known yet."}`;
}

/** One photo's part of the prompt: its name and link, what's known of it, and its tags. */
function photoSection(
  photo: BulkTagPhoto,
  places: Place[],
  index: number,
  sheets?: ContactSheet[],
): string {
  const { heading, known } = photoBasics(photo, places, index, sheets);
  const tags = savedTags(photo.data);
  return `${heading}
What's already known about it:
${known.join("\n") || "- Nothing yet."}
Tags it already has: ${tags.length > 0 ? tags.join(", ") : "none"}`;
}

/** ", which were picked to go together" when they were, or "" when they were picked whatever they share. */
function pickedTogether(photos: BulkTagPhoto[]): string {
  return photos.some((photo) => photo.related.length > 0)
    ? ", which were picked to go together"
    : "";
}

/**
 * The prompt to paste into a chat with an LLM, asking for tags for several photos at once, with the
 * same rules as one photo's tag prompt, and for the answer as JSON the backend reads. With contact
 * sheets, it links them and asks the LLM to start with them.
 */
export function bulkTagPrompt(
  photos: BulkTagPhoto[],
  lists: Omit<TagPromptLists, "known">,
  places: Place[],
  sheets?: ContactSheet[],
): string {
  return `Suggest tags for each of these ${photos.length} photos${pickedTogether(photos)}.

The tags are for a photography portfolio, where each tag gathers the photos that share a subject or an idea.
${sheetsBlock(sheets)}
${photos.map((photo, i) => photoSection(photo, places, i, sheets)).join("\n\n")}

Rules:
${TAG_RULES}
- Suggest 3 to 8 tags for each photo, leaving out the tags it already has. When a tag fits more than one of the photos, give it to each of them, spelled the same way.
- Answer with only this JSON, with nothing before or after it, and every photo listed once by its name in quotes above:
{
  "photos": [
    { "photo": "the photo's name", "tags": ["cultural-term", "subject"] }
  ],
  "definitions": [
    { "tag": "cultural-term", "definition": "a short definition", "parent": "general-tag" }
  ]
}
- In "definitions", define each cultural term or concept among the tags, once. When the term is a local kind of something more general, set "parent" to the general tag it belongs under, reusing an existing tag when one fits, such as { "tag": "shotengai", "definition": "a Japanese shopping street, often under a covered arcade", "parent": "covered-street" }; otherwise set it to "". Don't add the parent to a photo's tags.

${tagListsSection(lists)}`;
}
