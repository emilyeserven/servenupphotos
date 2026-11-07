import type { BulkTagPhoto } from "@/api/bulk-tags";
import type { Place } from "@/api/places";
import { ALT_TEXT_TARGET } from "@/lib/alt-text";
import { photoWithTags as photoSection } from "@/lib/bulk-tag-prompt";

/**
 * The prompt to paste into a chat with an LLM, asking for alt text for several photos at once, and
 * for the answer as JSON the backend reads.
 */
export function altTextPrompt(photos: BulkTagPhoto[], places: Place[]): string {
  return `Write alt text for each of these ${photos.length} photos.

The photos are on a photography portfolio. The alt text is what a screen reader reads out in place of each photo, for visitors who can't see it, and what shows when the photo can't load.

${photos.map((photo) => photoSection(photo, places)).join("\n\n")}

Rules:
- Open each link and look at the photo itself. What's known about it is only to help name what's in it, such as a place, a festival or a dish; leave out anything you can't see in the photo.
- Describe what the photo shows: its subject first, then what matters about the scene, such as the setting, the light, the time of day, colors or the mood it gives. Write what a sighted visitor would take in at a glance.
- Keep each one to one or two plain sentences, ideally under ${ALT_TEXT_TARGET} characters, ending with a period.
- Don't start with "Image of", "Photo of" or "Picture of": a screen reader already says it's an image.
- Name a place only when it's known and recognizable in the photo, such as "Gyeongbokgung Palace's throne hall". Don't guess at who people are; describe them instead ("a woman in a yellow raincoat").
- Write out words that are important and readable in the photo, such as a sign's name, in quotes.
- No hashtags, emoji, camera settings or opinions about the photo ("beautiful", "stunning").
- Answer with only this JSON, with nothing before or after it, and every photo listed once by its name in quotes above:
{
  "photos": [
    { "photo": "the photo's name", "altText": "A paper lantern glowing over a narrow alley at night, its light on wet stones." }
  ]
}`;
}
