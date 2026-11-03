import { type Group, albumTree } from "@/api/organize";
import { type TagPromptLists, filteredNames } from "@/lib/tag-prompt";

/** "1 photo", "2 photos". */
function photos(n: number): string {
  return `${n} ${n === 1 ? "photo" : "photos"}`;
}

/** One tag's line in the prompt: indented under its parent, with its photo count and description. */
function tagLine(tag: Group, depth: number, counts: ReadonlyMap<string, number>): string {
  const description = tag.description ? `: ${tag.description}` : "";
  return `${"  ".repeat(depth)}- ${tag.id} (${photos(counts.get(tag.id) ?? 0)})${description}`;
}

/** Every readable tag as a tree, each under its parent. */
function tagTreeLines(tags: Group[], counts: ReadonlyMap<string, number>): string[] {
  const readable = tags.filter((tag) => !tag.error);
  return albumTree(readable).map(({ group, depth }) => tagLine(group, depth, counts));
}

/**
 * The prompt to paste into a chat with an LLM, listing every tag with its parent, description and
 * photo count, and the photos of the tags with fewer than 3, and asking which to merge, remove or
 * put under another and which notes to add to those photos, as JSON the backend reads.
 */
export function pruneTagPrompt(
  lists: Omit<TagPromptLists, "known">,
  counts: ReadonlyMap<string, number>,
  fewPhotoLines: string[],
): string {
  const lines = tagTreeLines(lists.tags, counts);
  const filtered = filteredNames(lists);
  return `Help me prune the tags of my photography portfolio. Each tag gathers the photos that share a subject or an idea. A tag can sit under a more general parent tag (such as "shotengai", a Japanese shopping street, under "covered-street"), and filtering by the parent shows the photos of the tags under it too.

Suggest changes that make the ${lines.length} tags below easier to browse:
- Merge: fold a tag into another that means the same or nearly the same, such as a singular and a plural ("lamp" and "lamps"), a synonym or another spelling. Every photo with the merged tag gets the one it's merged into, and the tags under it move there too.
- Remove: drop a tag that doesn't help anyone find photos, such as one too vague to gather anything, one naming a specific place or thing rather than a kind of one, or one repeating what the site already filters photos by (where it was taken, the camera and lens, the date, its colors, its albums, its photographic genre, or a name under "Already filtered"). Removing a tag takes it off every photo, so merge it instead when another tag is close.
- Reparent: put a tag under a more general tag when it's a kind of it (such as "torii" under "shrine"), or move it to the top level when its parent doesn't fit.

Rules:
- Only use the tags listed, spelled exactly as listed. Merge into and reparent under existing tags only; don't invent new ones.
- Keep a culture's own word (such as "hanok" or "shotengai"): rather than merging it into a general tag, put it under one.
- Every tag should have at least 3 photos, and a tag under another (a subtag) especially. Remove or merge a tag with fewer, unless it's a culture's own word worth keeping under a general tag.
- Whenever a tag is removed for having too few photos, add a note to each photo it was on (listed by file name under "Photos" below), saying which tag it was, what in the photo it described, and why it isn't a tag (such as "Shows a koi pond; 'koi' isn't a tag, since only 2 photos have one."). Keep notes to one or two sentences.
- Be conservative: when unsure, leave a tag as it is. Give a short reason for each change.
- Name each tag in at most one merge or removal, and don't reparent a tag you merge or remove.
- Answer with only this JSON, with nothing before or after it:
{
  "merge": [{ "tag": "lamp", "into": "lamps", "reason": "a singular of lamps" }],
  "remove": [{ "tag": "vague-tag", "reason": "too vague to gather photos" }],
  "reparent": [{ "tag": "torii", "parent": "shrine", "reason": "a torii is a shrine gate" }],
  "notes": [{ "photo": "20161216_092741", "note": "Shows a koi pond; 'koi' isn't a tag, since only 2 photos have one." }]
}
- Use "parent": null to move a tag to the top level. Leave a list empty when there's nothing to suggest for it.

Tags, each under its parent, with how many photos have it and its description when it has one:
${lines.join("\n") || "- none yet"}

Already filtered: ${filtered.length > 0 ? filtered.join(", ") : "nothing else"}

Photos with a tag that fewer than 3 photos have, by file name, with their title and those tags:
${fewPhotoLines.join("\n") || "- none"}`;
}
