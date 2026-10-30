import { type Group, groupId } from "@/api/organize";
import type { CombinedPhoto } from "@/lib/group-photos";

/** How many tags with descriptions the prompt shows as examples of the style to write in. */
const STYLE_EXAMPLES = 8;

/** Whether the tag's file was read and has no description yet, or only spaces. */
function undescribed(tag: Group): boolean {
  return !tag.error && !tag.description?.trim();
}

/** The tags without a description, by ID, leaving out the ones in `skip`. */
export function tagsToDescribe(tags: Group[], skip: ReadonlySet<string>): Group[] {
  return tags
    .filter((tag) => undescribed(tag) && !skip.has(tag.id))
    .toSorted((a, b) => a.id.localeCompare(b.id));
}

/** A photo's list of tag IDs, as its JSON has it. */
function photoTags(photo: CombinedPhoto): string[] {
  return Array.isArray(photo.tags) ? photo.tags.filter((id) => typeof id === "string") : [];
}

/** The country a photo was taken in, the hand-written one over the one from its GPS. */
function photoCountry(photo: CombinedPhoto): string {
  const country = photo.customCountry || photo.country;
  return typeof country === "string" ? country : "";
}

/** The values in `values` that come up most often, most first, at most `limit` of them. */
function mostCommon(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

/** A line under a tag saying `lead` and then `values`, or no line when there are no values. */
function listLine(lead: string, values: string[]): string[] {
  return values.length > 0 ? [`  - ${lead} ${values.join(", ")}`] : [];
}

/** What the photos with the tag say about it: how many there are, where they're from, and the tags they share. */
function usageLines(id: string, photos: CombinedPhoto[]): string[] {
  const tagged = photos.filter((photo) => photoTags(photo).includes(id));
  if (tagged.length === 0) return ["  - No photos have it yet."];
  const others = tagged.flatMap(photoTags).filter((tag) => tag !== id);
  return [
    `  - On ${tagged.length} photo${tagged.length === 1 ? "" : "s"}`,
    ...listLine("Taken in", mostCommon(tagged.map(photoCountry), 3)),
    ...listLine("Often with", mostCommon(others, 6)),
  ];
}

/** The tag's parent and the tags under it, as lines under the tag. */
function familyLines(tag: Group, tags: Group[]): string[] {
  const children = tags.filter((other) => other.parent === tag.id).map((other) => other.id);
  return [
    ...listLine("A kind of", tag.parent ? [tag.parent] : []),
    ...listLine("More general than", children),
  ];
}

/** One tag's part of the prompt: its ID, then what's known about it. */
function tagSection(tag: Group, tags: Group[], photos: CombinedPhoto[]): string {
  return [`- "${tag.id}"`, ...familyLines(tag, tags), ...usageLines(tag.id, photos)].join("\n");
}

/** A few tags that have descriptions, as "tag: description" lines, for the style to match. */
function styleExamples(tags: Group[]): string {
  const described = tags.filter((tag) => !tag.error && tag.description?.trim());
  if (described.length === 0) return "";
  const lines = described.slice(0, STYLE_EXAMPLES).map((tag) => `- ${tag.id}: ${tag.description}`);
  return `\n\nDescriptions some tags already have, to match in style:\n${lines.join("\n")}`;
}

/**
 * The prompt to paste into a chat with an LLM, asking for a short description of each tag in
 * `batch`, with what the photos say about it, and for the answer as JSON `readTagDescriptions`
 * reads.
 */
export function tagDescriptionPrompt(
  batch: Group[],
  tags: Group[],
  photos: CombinedPhoto[],
): string {
  return `Write a short description for each of these ${batch.length} tags.

The tags are for a photography portfolio, where each tag gathers the photos that share a subject or an idea. The portfolio's Tags page shows each description under the tag's name, and its search reads them.

${batch.map((tag) => tagSection(tag, tags, photos)).join("\n")}

Rules:
- Describe what the tag means in general, not these photos: "a Japanese shopping street, often under a covered arcade", not "the shopping street in these photos".
- Write one phrase or short sentence of about 6 to 20 words, starting in lowercase (unless it starts with a name) and without a full stop at the end.
- For a cultural term, say which culture or language it comes from and what it is, such as "a traditional Korean house with a tiled roof and wooden frame".
- For an everyday word, say what it covers in photos, such as "people riding or parked bicycles" for "bicycles".
- Use the countries and the tags it's often with to tell which meaning a word has, but don't name the countries unless the term belongs to one.
- Answer with only this JSON, with nothing before or after it, and every tag listed once by its ID in quotes above:
{
  "descriptions": [
    { "tag": "the tag's ID", "description": "the description" }
  ]
}${styleExamples(tags)}`;
}

/** One description the answer gives, matched to a tag. */
export interface TagDescriptionAnswer {
  id: string;
  description: string;
  /** The description the tag has now, or "" when it has none. */
  current: string;
}

/** What the LLM's answer gives: descriptions for tags there are, and the names that aren't tags. */
export interface TagDescriptionsRead {
  found: TagDescriptionAnswer[];
  unknown: string[];
}

/** One entry of the answer's "descriptions", as it was written. */
interface AnswerEntry {
  tag: string;
  description: string;
}

function isAnswerEntry(value: unknown): value is AnswerEntry {
  const entry = value as Partial<AnswerEntry> | null;
  return typeof entry?.tag === "string" && typeof entry.description === "string";
}

/** The answer's JSON object, from its first `{` to its last `}`, so words or a code block around it are fine. */
function answerEntries(answer: string): AnswerEntry[] {
  const json = answer.slice(answer.indexOf("{"), answer.lastIndexOf("}") + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("The answer has no JSON object in it that can be read.");
  }
  const list = (parsed as { descriptions?: unknown } | null)?.descriptions;
  if (!Array.isArray(list)) throw new Error('The answer\'s JSON has no "descriptions" list.');
  return list.filter(isAnswerEntry);
}

/** The tag a name in the answer means: by its ID or name, ignoring case, or by the ID made from it. */
function findTag(tags: Group[], name: string): Group | undefined {
  const wanted = name.trim().toLowerCase();
  const id = groupId(name);
  return tags.find(
    (tag) => tag.id === wanted || tag.name.toLowerCase() === wanted || tag.id === id,
  );
}

/** The answers read so far, by tag ID, and the names that aren't tags. */
interface AnswerReading {
  found: Map<string, TagDescriptionAnswer>;
  unknown: string[];
}

/** The description the tag has now, or "" when it has none. */
function currentDescription(tag: Group): string {
  return tag.description?.trim() ?? "";
}

/** Adds one entry of the answer to `reading`: its tag's description, unless one came first, or its name as unknown. */
function readEntry(reading: AnswerReading, tags: Group[], entry: AnswerEntry) {
  const tag = findTag(tags, entry.tag);
  const description = entry.description.trim();
  if (!tag) reading.unknown.push(entry.tag);
  else if (description && !reading.found.has(tag.id))
    reading.found.set(tag.id, { id: tag.id, description, current: currentDescription(tag) });
}

/**
 * The LLM's answer to the description prompt, read against every tag: each tag it describes once
 * (the first description wins), with the description trimmed, and the names that aren't tags.
 * Throws, saying why, when the answer has no list of descriptions to read.
 */
export function readTagDescriptions(answer: string, tags: Group[]): TagDescriptionsRead {
  const readable = tags.filter((tag) => !tag.error);
  const reading: AnswerReading = { found: new Map(), unknown: [] };
  for (const entry of answerEntries(answer)) readEntry(reading, readable, entry);
  return { found: [...reading.found.values()], unknown: reading.unknown };
}
