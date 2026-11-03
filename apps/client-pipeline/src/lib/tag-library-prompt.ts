import type { TagLibraryExport, TagLibraryPhotoInfo } from "@/api/tag-library";

/** A photo's export with its empty fields left out, so the prompt stays short. */
function shortPhoto(photo: TagLibraryPhotoInfo): Record<string, unknown> {
  const filled = Object.entries(photo).filter(([, value]) =>
    Array.isArray(value) ? value.length > 0 : value !== "",
  );
  return Object.fromEntries(filled);
}

/** One JSON line per entry, in a JSON array. */
function lines(entries: unknown[]): string {
  return entries.length === 0
    ? "[]"
    : `[\n${entries.map((e) => `  ${JSON.stringify(e)}`).join(",\n")}\n]`;
}

/**
 * The whole tag library as JSON: every tag with its parent, description and photo count, and every
 * photo with what's known of it and its tags, one per line. It's what the prompt shows the LLM, and
 * what downloading the library saves.
 */
export function tagLibraryJson(library: TagLibraryExport): string {
  return `{\n"tags": ${lines(library.tags)},\n"photos": ${lines(library.photos.map(shortPhoto))}\n}\n`;
}

/** The answer the prompt asks for, as an example. */
const ANSWER_EXAMPLE = `{
  "newTags": [{ "tag": "paper-lanterns", "description": "lanterns made of paper", "parent": "lanterns", "reason": "5 photos show them" }],
  "rename": [{ "tag": "lamp", "to": "lamps", "reason": "other tags are plural" }],
  "merge": [{ "tag": "lamppost", "into": "lamps", "reason": "a kind of lamp" }],
  "remove": [{ "tag": "details", "reason": "too vague" }],
  "reparent": [{ "tag": "torii", "parent": "shrine", "reason": "a shrine gate" }],
  "describe": [{ "tag": "shotengai", "description": "a covered Japanese shopping street" }],
  "photos": [{ "photo": "20161216_092741", "add": ["paper-lanterns"], "remove": ["details"], "reason": "it shows paper lanterns" }],
  "notes": [{ "photo": "20161216_092741", "note": "Shows a koi pond; 'koi' wasn't made a tag, since only 2 photos have one." }]
}`;

/**
 * The prompt to paste into a chat with an LLM: the whole tag library and every photo's tags as
 * JSON, and the rules for answering with changes to all of it, as JSON the backend reads.
 * `filtered` is the names the site already filters by, as the tag prompt lists them.
 */
export function tagLibraryPrompt(library: TagLibraryExport, filtered: string[]): string {
  const min = library.minPhotos;
  return `Help me overhaul the tags of my photography portfolio. Each tag gathers the photos that share a subject or an idea. A tag can sit under a more general parent tag (such as "shotengai", a Japanese shopping street, under "covered-street"), and filtering by the parent shows the photos of the tags under it too.

Below is every tag (with its parent, description and how many photos have it) and every photo (by its file name, with its title, where it was taken, its places, genres, albums, tags and my private notes). Read all of it, then suggest the changes that make the whole library consistent and easy to browse:
- newTags: a tag several photos share that's missing. Give it a short description and a parent when one fits (an existing tag, or another new one).
- rename: give a tag a better ID, keeping its photos, description and the tags under it.
- merge: fold a tag into another that means the same or nearly the same (a singular and a plural, a synonym, another spelling).
- remove: drop a tag that doesn't help anyone find photos: too vague, naming one specific place or thing, or repeating what the site already filters by (where it was taken, the camera and lens, the date, its colors, its albums, its genre, or a name under "Already filtered").
- reparent: put a tag under a more general tag it's a kind of, or at the top level ("parent": null).
- describe: give a tag without a description (or with a poor one) a one-line description.
- photos: tags to add to or take off one photo, by its file name. Add tags from the library or your newTags only.
- notes: a private note on one photo, for things worth remembering that aren't tags.

Rules:
- Every tag should have at least ${min} photos, and a tag under another (a subtag) especially. Don't make a tag that fewer than ${min} photos would have, and remove or merge a tag left with fewer, unless more photos clearly should have it (then add it to them under "photos").
- Whenever a tag is removed, or a tag you considered isn't made, because too few photos would have it, add a note to each photo it was or would have been on, saying which tag it was, what in the photo it described, and why it isn't a tag (such as "Shows a koi pond; 'koi' isn't a tag, since only 2 photos have one."). Keep notes to one or two sentences.
- Write tag IDs in lowercase kebab-case, such as "street-lights". Use existing tags spelled exactly as listed.
- Keep a culture's own word (such as "hanok" or "shotengai"): rather than merging it into a general tag, put it under one.
- Changes are made in this order: newTags, rename, merge, remove, reparent, describe, photos, notes. Later lists use the names after earlier ones (a photo's "add" can use a renamed tag's new ID). Name each tag in at most one rename, merge or removal.
- Be conservative: when unsure, leave a tag or photo as it is. Give a short reason for each change.
- Answer with only this JSON, with nothing before or after it, leaving a list empty when there's nothing to suggest for it:
${ANSWER_EXAMPLE}

Already filtered: ${filtered.length > 0 ? filtered.join(", ") : "nothing else"}

The tag library:
${tagLibraryJson(library)}`;
}

/**
 * One line per photo that has a tag with fewer than the library's fewest photos a tag should have:
 * its file name, title and those tags, so a prompt can ask for a note on it when they're removed.
 */
export function fewPhotoTagLines(library: TagLibraryExport): string[] {
  const few = new Set(library.tags.filter((t) => t.photos < library.minPhotos).map((t) => t.tag));
  return library.photos.flatMap((photo) => {
    const tags = photo.tags.filter((tag) => few.has(tag));
    if (tags.length === 0) return [];
    const title = photo.title ? ` "${photo.title}"` : "";
    return [`- ${photo.photo}${title}: ${tags.join(", ")}`];
  });
}
