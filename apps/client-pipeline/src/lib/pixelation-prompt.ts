import type { ContactSheet } from "@/api/contact-sheets";
import { type AutogroupPhoto, photoFinder } from "@/lib/compare-autogroup";
import { readPastedList } from "@/lib/pasted-json";
import { lookAtPhotos, tileNote } from "@/lib/contact-sheets";
import { titleOf } from "@/lib/drafts";
import { FACES } from "@/lib/photo-fields";
import type { QualityFlag } from "@/lib/quality-flags";
import { textOf } from "@portfolio/lib/values";

/** Whether the photo has areas pixelated already, so its Small version shows blocks there. */
function isPixelated(data: Record<string, unknown>): boolean {
  return Array.isArray(data[FACES]) && data[FACES].length > 0;
}

/** One photo's line in the prompt: its name, its tile, its Small image, title and pixelated areas. */
function photoLine(entry: AutogroupPhoto, index: number, sheets?: ContactSheet[]): string {
  const lines = [`Photo "${entry.key}"${tileNote(sheets, index)}: ${entry.imageUrl}`];
  const title = titleOf(entry.photo.data);
  if (title) lines.push(`- Title: ${title}`);
  if (isPixelated(entry.photo.data)) lines.push("- Some areas are pixelated already");
  return lines.join("\n");
}

/**
 * The prompt to paste into a chat with an LLM, linking each photo's Small image (and the contact
 * sheets made of them, when there are any) and asking which show a readable license plate or a
 * face someone could recognize, so they can be pixelated before they're posted, with the answer
 * as JSON the Quality Check page reads.
 */
export function pixelationPrompt(photos: AutogroupPhoto[], sheets?: ContactSheet[]): string {
  return `Check these ${photos.length} photos for anything that should be pixelated before they're posted on my photography portfolio: license plates that can be read, and faces of people who could be recognized.
${lookAtPhotos(sheets, "Open each photo's link and look at the whole photo.")}

When a tile shows a car, a motorbike or people, open that photo's own link to look closely: a plate or a face that's too small to make out on the sheet can still be readable in the photo.

${photos.map((entry, i) => photoLine(entry, i, sheets)).join("\n\n")}

Rules:
- Flag a photo when it shows a license plate whose characters could be read, or a face that someone who knows the person could recognize: turned toward the camera, in focus and large enough to make out.
- Don't flag faces that are tiny in the frame, blurred by motion or depth of field, turned away, in silhouette or hidden, or plates too small, blurred or angled to read. Don't flag statues, mannequins, posters, ads or screens.
- Blocks of color on a photo marked as pixelated already are hidden areas; flag it only for something else still visible.
- For each photo you flag, list what needs hiding in "pixelate" ("face" or "license plate", once each), give a short re-edit reason in "reEdit" (a few words, such as "Pixelate 2 faces and a license plate"), and say in "note" exactly what and where, in one or two sentences, so I can find it, such as "The man at the café table on the left and the woman behind him face the camera; the white van's plate at the bottom right is readable."
- Answer with only this JSON, with nothing before or after it, listing each flagged photo by its name in quotes above:
{
  "photos": [
    { "photo": "20161216_092741", "pixelate": ["face", "license plate"], "reEdit": "Pixelate 2 faces and a license plate", "note": "The man at the café table on the left and the woman behind him face the camera; the white van's plate at the bottom right is readable." }
  ]
}
- Answer with { "photos": [] } when no photo needs pixelation.`;
}

/** A photo the LLM flagged for pixelation: the photo, what to hide, and its re-edit flag. */
export interface PixelationFlag {
  entry: AutogroupPhoto;
  /** What needs hiding, such as ["face", "license plate"]. */
  pixelate: string[];
  flag: QualityFlag;
}

/** The LLM's answer as the page reads it: the flagged photos, and names that aren't photos here. */
export interface PixelationAnswer {
  flagged: PixelationFlag[];
  unknown: string[];
}

/** A photo as the answer gives it, before it's looked up. */
interface RawFlag {
  photo: string;
  pixelate: string[];
  reEdit: string;
  note: string;
}

/** The answer's photos that have a name. */
function rawFlags(answer: string): RawFlag[] {
  return readPastedList(answer, "photos")
    .map((raw) => (raw ?? {}) as Record<string, unknown>)
    .map((raw) => ({
      photo: textOf(raw.photo),
      pixelate: Array.isArray(raw.pixelate) ? raw.pixelate.map(textOf).filter(Boolean) : [],
      reEdit: textOf(raw.reEdit),
      note: textOf(raw.note),
    }))
    .filter((raw) => raw.photo !== "");
}

/** The flag for a raw answer: its reason and note, made up from what to hide when it gave none. */
function qualityFlag(raw: RawFlag): QualityFlag {
  const what = raw.pixelate.length > 0 ? raw.pixelate.join(" and ") : "faces or license plates";
  const note = raw.note || `Shows ${what} to pixelate.`;
  return {
    reason: raw.reEdit || `Pixelate ${what}`,
    note: `Quality Check (pixelation): ${note}`,
  };
}

/**
 * Reads the LLM's answer into the photos to flag, looking each up among the prompt's photos. A
 * photo named twice is flagged once, for the first. Throws an error a user can read when the
 * answer isn't the JSON the prompt asks for.
 */
export function readPixelationAnswer(answer: string, photos: AutogroupPhoto[]): PixelationAnswer {
  const find = photoFinder(photos);
  const seen = new Set<string>();
  const unknown = new Set<string>();
  const flagged: PixelationFlag[] = [];
  for (const raw of rawFlags(answer)) {
    const entry = find(raw.photo);
    if (!entry) unknown.add(raw.photo);
    else if (!seen.has(entry.key)) {
      seen.add(entry.key);
      flagged.push({ entry, pixelate: raw.pixelate, flag: qualityFlag(raw) });
    }
  }
  return { flagged, unknown: [...unknown] };
}
