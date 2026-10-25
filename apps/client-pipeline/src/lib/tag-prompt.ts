import { type Group, type OrganizeResponse, groupId, groupLabel } from "@/api/organize";
import { META_FIELDS, type MetaGroup } from "@/api/metainfo";

/**
 * The photo's versions to link in the tag prompt, smallest that still works first. Small (500px on
 * its long edge) is a few hundred tokens for Claude, GPT and Gemini and still shows the subject
 * clearly; Medium (1200px) is about five times that, so it's only used when there's no Small.
 */
const PROMPT_VERSIONS = ["small", "medium"] as const;

/** The URL of the version of the photo the tag prompt links to, or else `fallback`. */
export function promptImageUrl(images: Record<string, unknown> | undefined, fallback: string) {
  const found = PROMPT_VERSIONS.map((name) => images?.[name]).find(
    (url): url is string => typeof url === "string" && url !== "",
  );
  return found ?? fallback;
}

/** What the tag prompt tells the LLM about: the tags to reuse and the names not to make into tags. */
export interface TagPromptLists {
  tags: Group[];
  albums: Group[];
  metaGroups: MetaGroup[];
}

/** The field a metadata group is of, as the prompt names it, such as "focal length". */
function metaFieldName(group: MetaGroup): string {
  return META_FIELDS.find((info) => info.field === group.field)?.one ?? group.field;
}

/** names as the prompt lists them, or `none` when there are none. */
function listed(names: string[], none: string): string {
  return names.length > 0 ? names.join(", ") : none;
}

/** The names the site already filters photos by, which the prompt asks the LLM not to suggest. */
function filteredNames({ albums, metaGroups }: TagPromptLists): string[] {
  return [
    ...albums.filter((album) => !album.error).map((album) => `${groupLabel(album)} (album)`),
    ...metaGroups.map((group) => `${group.name} (${metaFieldName(group)})`),
  ];
}

/** The prompt to paste into a chat with an LLM, asking for tags for the photo at `imageUrl`. */
export function tagPrompt(imageUrl: string, lists: TagPromptLists): string {
  const existing = lists.tags.filter((tag) => !tag.error).map(groupLabel);
  return `Suggest tags for the photo at this link: ${imageUrl}

The tags are for a photography portfolio, where each tag gathers the photos that share a subject or an idea.

Rules:
- Reuse an existing tag (listed below) whenever one fits, spelled exactly as it is listed.
- Keep tags general enough to fit other photos too: "temple" rather than "the main hall of Bulguksa".
- Put cultural terms and concepts first (such as "hanok", "matsuri" or "wabi-sabi"), then the photo's main subjects (such as "architecture", "street food" or "cats").
- A kind of place is a good tag (such as "mosque", "temple", "lake" or "city"), but a named one isn't: leave out "Seoul", "Lake Biwa" or "Blue Mosque".
- Leave out anything else the site already filters photos by: where it was taken (its country, state, city or named place), the camera, lens, focal length, aperture, exposure and ISO, the date it was taken, its colors and how vivid they are, and its albums. Don't suggest any of the names under "Already filtered" either.
- Suggest 3 to 8 tags.
- Answer with only the tags, as one comma-separated list, with nothing before or after it.

Existing tags: ${listed(existing, "none yet")}

Already filtered: ${listed(filteredNames(lists), "nothing else")}`;
}

/** One tag the LLM answered with, as it's written, with its surrounding quotes, bullets and dots taken off. */
function cleanName(name: string): string {
  return name
    .trim()
    .replace(/^[-*•#\d.)\s]+|[.\s]+$/g, "")
    .replace(/^["'“‘]+|["'”’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The tags in the LLM's answer, split at commas and new lines, without blanks or repeats (ignoring case). */
export function parseTagList(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/[,\n]/)
    .map(cleanName)
    .filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** What the pasted tags are: tags to add, new ones to make, and ones that can't be tags. */
export interface PastedTags {
  /** The IDs of existing tags they name, without repeats. */
  existing: string[];
  /** Names no album, tag or metadata group has, which can be made into new tags. */
  fresh: string[];
  /** Names that can't be tags, with why. */
  skipped: { name: string; reason: string }[];
}

/** Whether `group` is named `name` or has the ID made from it, ignoring case. */
function isNamed(group: Group, name: string): boolean {
  return group.name.trim().toLowerCase() === name.toLowerCase() || group.id === groupId(name);
}

/** Why a name that isn't an existing tag can't be made into one, if it can't. */
function skipReason(name: string, organize: OrganizeResponse, metaGroups: MetaGroup[]) {
  if (!groupId(name)) return "it has no letter or number from a to z or 0 to 9 to make an ID from";
  if (organize.albums.some((album) => isNamed(album, name))) return "an album has that name";
  const lower = name.toLowerCase();
  if (metaGroups.some((group) => group.name.toLowerCase() === lower)) {
    return "a metadata group has that name";
  }
  return undefined;
}

/** Puts one pasted name into result: an existing tag's ID, a skipped name or a new one. */
function sortName(
  result: PastedTags,
  name: string,
  organize: OrganizeResponse,
  metaGroups: MetaGroup[],
) {
  const tag = organize.tags.find((t) => !t.error && isNamed(t, name));
  if (tag) return result.existing.push(tag.id);
  const reason = skipReason(name, organize, metaGroups);
  return reason ? result.skipped.push({ name, reason }) : result.fresh.push(name);
}

/** Sorts each pasted name into an existing tag, a new one or a skipped one. */
export function matchTags(
  pasted: string[],
  organize: OrganizeResponse,
  metaGroups: MetaGroup[],
): PastedTags {
  const result: PastedTags = { existing: [], fresh: [], skipped: [] };
  for (const name of pasted) sortName(result, name, organize, metaGroups);
  return { ...result, existing: [...new Set(result.existing)], fresh: uniqueIds(result.fresh) };
}

/** names without the ones that would get the same ID as one before them, such as "Street food" and "street-food". */
function uniqueIds(names: string[]): string[] {
  return names.filter(
    (name, i) => names.findIndex((other) => groupId(other) === groupId(name)) === i,
  );
}

/** `tags` with `added` after them, leaving out any it already has. */
export function withTags(tags: string[], added: string[]): string[] {
  return [...new Set([...tags, ...added])];
}
