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
  /** The photographic genres, which the portfolio filters by too. */
  genres: Group[];
  metaGroups: MetaGroup[];
  /** What's known of where the photo was taken, one "- Label: value" line per fact. */
  known: string[];
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
function filteredNames({ albums, genres, metaGroups }: TagPromptLists): string[] {
  return [
    ...albums.filter((album) => !album.error).map((album) => `${groupLabel(album)} (album)`),
    ...genres.filter((genre) => !genre.error).map((genre) => `${groupLabel(genre)} (genre)`),
    ...metaGroups.map((group) => `${group.name} (${metaFieldName(group)})`),
  ];
}

/** The prompt to paste into a chat with an LLM, asking for tags for the photo at `imageUrl`. */
export function tagPrompt(imageUrl: string, lists: TagPromptLists): string {
  const existing = lists.tags.filter((tag) => !tag.error).map((tag) => tag.id);
  return `Suggest tags for the photo at this link: ${imageUrl}

The tags are for a photography portfolio, where each tag gathers the photos that share a subject or an idea.

What's already known about the photo:
${lists.known.join("\n") || "- Nothing yet."}

Rules:
- Reuse an existing tag (listed below) whenever one fits, spelled exactly as it is listed.
- Write every tag in lowercase kebab-case: lowercase words joined by single dashes, such as "street-food" or "wabi-sabi".
- Keep tags general enough to fit other photos too: "temple" rather than "bulguksa-main-hall".
- Put cultural terms and concepts first (such as "hanok", "matsuri" or "wabi-sabi"), then the photo's main subjects (such as "lanterns", "street-food" or "cats").
- Use what's known about where the photo was taken to pick terms that fit it: use a culture's own word (such as "shotengai", a Japanese shopping street, or "hanok", a traditional Korean house) only when the photo is from that culture, and otherwise use a general one (such as "covered-street" or "shopping-street"). Never turn what's known (its place, city or country) into a tag.
- A kind of place is a good tag (such as "mosque", "temple", "lake" or "city"), but a named one isn't: leave out "seoul", "lake-biwa" or "blue-mosque".
- Leave out anything else the site already filters photos by: where it was taken (its country, state, city or named place), the camera, lens, focal length, aperture, exposure and ISO, the date it was taken, its colors and how vivid they are, its albums, and its photographic genre (such as street, landscape or portrait). Don't suggest any of the names under "Already filtered" either.
- Suggest 3 to 8 tags.
- Answer with the tags as one comma-separated list on the first line. Then, after a blank line, define each cultural term or concept among them, one per line, as "tag: a short definition". When the term is a local kind of something more general, end its line with the general tag it belongs under, as "(parent: general-tag)", reusing an existing tag when one fits, such as "shotengai: a Japanese shopping street, often under a covered arcade (parent: covered-street)". Don't add the parent to the first line. Write nothing else before or after.

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

/** A line of the LLM's answer that defines a tag, such as "shotengai: a Japanese shopping street". */
const DEFINITION = /^[\s\-*•]*([^:,]+?)\s*:\s*(.+?)\s*$/;

/** What the LLM said of one of its tags: what it means, and the more general tag it belongs under. */
export interface TagDefinition {
  definition: string;
  /** The parent tag's ID, such as "covered-street" for "shotengai"; absent when it gave none. */
  parent?: string;
}

/** The "(parent: general-tag)" at the end of a definition line. */
const PARENT = /\s*\(\s*parent\s*:\s*([^)]*)\)\s*$/i;

/** A definition line's text, without its parent, and the parent's ID when it names one. */
function readDefinition(text: string): TagDefinition {
  const parent = groupId(PARENT.exec(text)?.[1] ?? "");
  const definition = text.replace(PARENT, "").trim();
  return parent ? { definition, parent } : { definition };
}

/**
 * The definitions the LLM gave under its tags, by the ID each defined tag gets, such as
 * `{ shotengai: { definition: "a Japanese shopping street", parent: "covered-street" } }`.
 */
export function parseDefinitions(text: string): Record<string, TagDefinition> {
  const pairs = text.split("\n").flatMap((line) => {
    const match = DEFINITION.exec(line);
    return match ? [[groupId(cleanName(match[1]!)), readDefinition(match[2]!)] as const] : [];
  });
  return Object.fromEntries(pairs.filter(([id]) => id));
}

/** One tag to make: its ID, description and parent, and whether it goes on the photo. */
export interface TagToMake {
  id: string;
  description: string;
  parent?: string;
  /** False for a parent made only so a new tag can be under it. */
  add: boolean;
}

/**
 * The tags to make, in the order to make them: each chosen name with its definition as its
 * description and, when it's under one, its parent; any parent that isn't a tag and isn't being
 * made comes first, so it's there when its child is made.
 */
export function tagsToMake(
  chosen: string[],
  definitions: Record<string, TagDefinition>,
  underParent: ReadonlySet<string>,
  existing: ReadonlySet<string>,
): TagToMake[] {
  const children = chosen.map((id) => ({
    id,
    description: describedAs(definitions[id]),
    parent: underParent.has(id) ? parentOf(definitions[id]) : undefined,
    add: true,
  }));
  const missing = [...new Set(children.flatMap((child) => child.parent ?? []))]
    .filter((id) => !existing.has(id) && !chosen.includes(id))
    .map((id) => ({ id, description: "", add: false }));
  return [...missing, ...orderedChildren(children)];
}

/** A new tag's description: the LLM's definition of it, or "" when it gave none. */
function describedAs(definition: TagDefinition | undefined): string {
  return definition?.definition ?? "";
}

/** The parent the LLM suggests for a new tag, if any. */
function parentOf(definition: TagDefinition | undefined): string | undefined {
  return definition?.parent;
}

/** children with the ones that are another's parent first. */
function orderedChildren(children: TagToMake[]): TagToMake[] {
  const parents = new Set(children.flatMap((child) => child.parent ?? []));
  return children.toSorted((a, b) => Number(parents.has(b.id)) - Number(parents.has(a.id)));
}

/**
 * The tags in the LLM's answer, split at commas and new lines, without blanks or repeats (ignoring
 * case). Lines that define a tag ("tag: definition") are left out.
 */
export function parseTagList(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split("\n")
    .filter((line) => !DEFINITION.test(line))
    .join("\n")
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
  /** New tags to make, in lowercase kebab-case, for names no album, tag, genre or metadata group has. */
  fresh: string[];
  /** Names that can't be tags, with why. */
  skipped: { name: string; reason: string }[];
}

/** Whether `group` is named `name` or has the ID made from it, ignoring case. */
function isNamed(group: Group, name: string): boolean {
  return group.name.trim().toLowerCase() === name.toLowerCase() || group.id === groupId(name);
}

/** Which of the album and genre lists has a group named `name`, as a reason to skip it. */
function namedGroupReason(name: string, organize: OrganizeResponse): string | undefined {
  const lists = [
    [organize.albums, "an album has that name"],
    [organize.genres, "a genre has that name"],
  ] as const;
  return lists.find(([groups]) => groups.some((group) => isNamed(group, name)))?.[1];
}

/** Why a name that isn't an existing tag can't be made into one, if it can't. */
function skipReason(name: string, organize: OrganizeResponse, metaGroups: MetaGroup[]) {
  if (!groupId(name)) return "it has no letter or number from a to z or 0 to 9 to make an ID from";
  const named = namedGroupReason(name, organize);
  if (named) return named;
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
  return reason ? result.skipped.push({ name, reason }) : result.fresh.push(groupId(name));
}

/** Sorts each pasted name into an existing tag, a new one or a skipped one. */
export function matchTags(
  pasted: string[],
  organize: OrganizeResponse,
  metaGroups: MetaGroup[],
): PastedTags {
  const result: PastedTags = { existing: [], fresh: [], skipped: [] };
  for (const name of pasted) sortName(result, name, organize, metaGroups);
  return { ...result, existing: [...new Set(result.existing)], fresh: [...new Set(result.fresh)] };
}

/** `tags` with `added` after them, leaving out any it already has. */
export function withTags(tags: string[], added: string[]): string[] {
  return [...new Set([...tags, ...added])];
}
