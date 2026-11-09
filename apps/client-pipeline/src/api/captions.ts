import { overrideId } from "@/api/cameras";
import { byName, settingEntries, settingMutations } from "@/api/data-files";

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
export const captionTemplates = settingEntries("captions", isTemplate, byName);

/**
 * The template a post on platform starts with, its default: the first one for that platform, or
 * else the first one for any, or else the first; undefined when there are none.
 */
export function defaultCaptionTemplate(
  templates: CaptionTemplate[],
  platform: string,
): CaptionTemplate | undefined {
  const forPlatform = (p: string) => templates.find((t) => t.platform === p);
  return forPlatform(platform) ?? forPlatform("") ?? templates[0];
}

/** The ID a new template gets, such as `instagram-travel`. */
export const captionTemplateId = overrideId;

const templateMutations = settingMutations<CaptionTemplate>("captions");

/** Saves a caption template, new or changed, as a change waiting for Commit. */
export const saveCaptionTemplateMutation = templateMutations.save;

/** Removes a caption template, as a change waiting for Commit. */
export const deleteCaptionTemplateMutation = templateMutations.remove;
