import type { BulkTagPhoto } from "@/api/bulk-tags";
import type { Place } from "@/api/places";
import { savedDetails, savedExifPlace } from "@/components/photo-details";
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

/**
 * The first line of a picked photo's part of a prompt, `Photo "name": link`, and what's known of it
 * and where it was taken, one "- Label: value" line per fact.
 */
export function photoBasics(photo: BulkTagPhoto, places: Place[]) {
  const { data } = photo;
  const images = data.images as Record<string, unknown> | undefined;
  return {
    heading: `Photo "${photo.name}": ${promptImageUrl(images, fullImage(data))}`,
    known: knownLines({ details: savedDetails(data), exif: savedExifPlace(data), places }),
  };
}

/** One photo's part of the prompt: its name and link, what's known of it, and its tags. */
function photoSection(photo: BulkTagPhoto, places: Place[]): string {
  const { heading, known } = photoBasics(photo, places);
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
 * same rules as one photo's tag prompt, and for the answer as JSON the backend reads.
 */
export function bulkTagPrompt(
  photos: BulkTagPhoto[],
  lists: Omit<TagPromptLists, "known">,
  places: Place[],
): string {
  return `Suggest tags for each of these ${photos.length} photos${pickedTogether(photos)}.

The tags are for a photography portfolio, where each tag gathers the photos that share a subject or an idea.

${photos.map((photo) => photoSection(photo, places)).join("\n\n")}

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
