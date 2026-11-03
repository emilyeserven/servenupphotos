import { overrideId } from "@/api/cameras";
import { settingMutations } from "@/api/data-files";
import type { CombinedData } from "@/api/photos";

/**
 * A caption template file: a social media post's caption with placeholders for the photo's
 * fields, such as `{title}` or `{camera}`, which the Photo page's Generate fills in. Commit combines
 * them into CAPTIONS.json.
 */
export interface CaptionTemplate {
  /** Made from the name when the template is made, and kept after that. */
  id: string;
  /** How the Photo page lists it, such as "Instagram". */
  name: string;
  /** The social media site it's for, such as "instagram", which a post there starts with; "" for any. */
  platform: string;
  /** The caption's text, with placeholders in braces. */
  template: string;
}

function isTemplate(value: unknown): value is CaptionTemplate {
  return typeof (value as Partial<CaptionTemplate> | null)?.template === "string";
}

/** The caption templates as the next Commit will have them: CAPTIONS.json with the changes since, by name. */
export function captionTemplates(data: CombinedData | undefined): CaptionTemplate[] {
  const entries = data ? (data.head ?? data.base).captions.data : undefined;
  return (entries ?? []).filter(isTemplate).toSorted((a, b) => a.name.localeCompare(b.name));
}

/** The ID a new template gets, such as `instagram-travel`. */
export const captionTemplateId = overrideId;

const templateMutations = settingMutations<CaptionTemplate>("captions");

/** Saves a caption template, new or changed, as a change waiting for Commit. */
export const saveCaptionTemplateMutation = templateMutations.save;

/** Removes a caption template, as a change waiting for Commit. */
export const deleteCaptionTemplateMutation = templateMutations.remove;
