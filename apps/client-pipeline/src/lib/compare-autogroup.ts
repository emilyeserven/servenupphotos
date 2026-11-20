import { type ComparePhoto, compareGroupOf, compareGroups, isWinner } from "@/lib/compare-groups";
import { isDraft, isUnselected, titleOf } from "@/lib/drafts";
import { CREATE_DATE, CUSTOM_DATE } from "@/lib/photo-fields";
import type { ContactSheet, ContactSheetPhoto } from "@/api/contact-sheets";
import { lookAtPhotos, tileNote } from "@/lib/contact-sheets";
import { promptImageUrl } from "@/lib/tag-prompt";
import { parsePastedJson } from "@/lib/pasted-json";

/** Which photos Autogroup asks about: every photo, or only the drafts. */
export type AutogroupScope = "all" | "drafts";

/** What Autogroup asks about: which photos, and whether the LLM may change the groups there are. */
export interface AutogroupOptions {
  scope: AutogroupScope;
  /** Sends the compare groups there are, so the LLM can add photos to them, combine them or remove them. */
  withGroups: boolean;
}

/** Which photos `autogroupPhotos` lists, as Quality Check and Re-Edit pick them too. */
export interface AutogroupPhotoOptions {
  scope: AutogroupScope;
  /** Leaves out photos already in a compare group. */
  skipGrouped: boolean;
}

/** A photo in an Autogroup prompt: the photo, the name the prompt calls it by, and its Small image. */
export interface AutogroupPhoto {
  photo: ComparePhoto;
  /** Its JSON file's name without `.json`, such as `20161216_092741`, unique to the photo. */
  key: string;
  /** The image the prompt links: its Small version, else its Medium one, else its original. */
  imageUrl: string;
  /** When it was taken, as `YYYY-MM-DD HH:MM:SS`, the custom date first, or "" without one. */
  takenAt: string;
}

/** The photo's JSON file name without its folder or `.json`, which the prompt calls it by. */
function autogroupKey(photo: ComparePhoto): string {
  const name = photo.file.path.split("/").at(-1) ?? photo.file.path;
  return name.replace(/\.json$/i, "");
}

/** When the photo was taken, as `YYYY-MM-DD HH:MM:SS`, the custom date first, or "" without one. */
function takenAt(data: Record<string, unknown>): string {
  const date = [data[CUSTOM_DATE], data[CREATE_DATE]].find(
    (value): value is string => typeof value === "string" && /^\d{4}[:-]\d{2}[:-]\d{2}/.test(value),
  );
  if (!date) return "";
  const day = date.slice(0, 10).replaceAll(":", "-");
  const time = /\d{2}:\d{2}(:\d{2})?/.exec(date.slice(10))?.[0];
  return time ? `${day} ${time}` : day;
}

/** The image the prompt links for the photo, or "" when it has none. */
function promptImage(photo: ComparePhoto): string {
  const images = photo.data.images as Record<string, unknown> | undefined;
  return promptImageUrl(images, photo.imageUrl ?? "");
}

/** Whether the photo is listed with these options: it isn't unselected and fits the scope. */
function wanted(photo: ComparePhoto, options: AutogroupPhotoOptions): boolean {
  if (isUnselected(photo.data)) return false;
  if (options.scope === "drafts" && !isDraft(photo.data)) return false;
  return !(options.skipGrouped && compareGroupOf(photo.data));
}

/** Oldest first, so photos taken together sit next to each other in the prompt. */
function byTaken(a: AutogroupPhoto, b: AutogroupPhoto): number {
  if (a.takenAt !== b.takenAt) {
    if (!a.takenAt) return 1;
    if (!b.takenAt) return -1;
    return a.takenAt.localeCompare(b.takenAt);
  }
  return a.key.localeCompare(b.key, undefined, { numeric: true });
}

/** The photo as the prompt shows it, with its name, image and when it was taken. */
function asPromptPhoto(photo: ComparePhoto): AutogroupPhoto {
  return {
    photo,
    key: autogroupKey(photo),
    imageUrl: promptImage(photo),
    takenAt: takenAt(photo.data),
  };
}

/** The photos as the prompt shows them, oldest first, leaving out ones without an image. */
function promptPhotos(photos: ComparePhoto[]): AutogroupPhoto[] {
  return photos
    .map(asPromptPhoto)
    .filter((entry) => entry.imageUrl !== "")
    .toSorted(byTaken);
}

/**
 * The photos a prompt can ask about, oldest first: the drafts or every photo, leaving out
 * unselected photos (their images may be gone), photos without an image, and, when asked, photos
 * already in a group.
 */
export function autogroupPhotos(
  photos: ComparePhoto[],
  options: AutogroupPhotoOptions,
): AutogroupPhoto[] {
  return promptPhotos(photos.filter((photo) => wanted(photo, options)));
}

/** A compare group there is already, as the prompt shows it. */
export interface ExistingGroup {
  name: string;
  /** Its photos, oldest first, including any without an image, which the prompt leaves out. */
  photos: AutogroupPhoto[];
}

/** What one Autogroup prompt asks about: photos in no group, and the compare groups there are. */
export interface AutogroupAsk {
  /** The photos in no group, oldest first. */
  loose: AutogroupPhoto[];
  /** The compare groups there are, empty unless the LLM may change them. */
  groups: ExistingGroup[];
}

/**
 * What Autogroup asks about: the drafts or every photo in no group, oldest first, leaving out
 * unselected photos (their images may be gone) and photos without an image, and, when the LLM may
 * change them, every compare group with its photos.
 */
export function autogroupAsk(photos: ComparePhoto[], options: AutogroupOptions): AutogroupAsk {
  const loose = autogroupPhotos(photos, { scope: options.scope, skipGrouped: true });
  if (!options.withGroups) return { loose, groups: [] };
  const groups = compareGroups(photos).map((group) => ({
    name: group.name,
    photos: group.photos.map(asPromptPhoto).toSorted(byTaken),
  }));
  return { loose, groups };
}

/** The photos the prompt links, in its order: the ones in no group, then each group's with an image. */
export function linkedPhotos(ask: AutogroupAsk): AutogroupPhoto[] {
  return [
    ...ask.loose,
    ...ask.groups.flatMap((group) => group.photos.filter((entry) => entry.imageUrl !== "")),
  ];
}

/** The photos as the contact sheets show them, in the order given. */
export function autogroupSheetPhotos(photos: AutogroupPhoto[]): ContactSheetPhoto[] {
  return photos.map((entry) => ({ label: entry.key, url: entry.imageUrl }));
}

/** Every photo in the prompt, loose or in a group. */
export function askedPhotos(ask: AutogroupAsk): AutogroupPhoto[] {
  return [...ask.loose, ...ask.groups.flatMap((group) => group.photos)];
}

/** What a photo's line adds after its name to say where it is on the contact sheets, or "". */
type TileNote = (entry: AutogroupPhoto) => string;

/**
 * One photo's part of the prompt: its name, its tile on the contact sheets when there are any, its
 * image, when it was taken, its title, and whether it won.
 */
function photoSection(entry: AutogroupPhoto, tile: TileNote): string {
  const lines = [`Photo "${entry.key}"${tile(entry)}: ${entry.imageUrl}`];
  if (entry.takenAt) lines.push(`- Taken: ${entry.takenAt}`);
  const title = titleOf(entry.photo.data);
  if (title) lines.push(`- Title: ${title}`);
  if (isWinner(entry.photo)) lines.push("- Picked as a winner of its group");
  return lines.join("\n");
}

/** One group's part of the prompt: its name, then each of its photos with an image. */
function groupSection(group: ExistingGroup, tile: TileNote): string {
  const shown = group.photos.filter((entry) => entry.imageUrl !== "");
  return `Group "${group.name}" (${shown.length} photos):
${shown.map((entry) => photoSection(entry, tile)).join("\n")}`;
}

/** The groups there are, and what the LLM may do with them, when it may change them. */
function groupsSection(groups: ExistingGroup[], tile: TileNote): string {
  if (groups.length === 0) return "";
  return `

Compare groups I have already (${groups.length}):

${groups.map((group) => groupSection(group, tile)).join("\n\n")}`;
}

/** The rules about the groups there are, when the prompt sends them. */
function groupRules(groups: ExistingGroup[]): string {
  if (groups.length === 0) return "";
  return `
- You can change the compare groups I have already:
  - Add photos to one of them: put it in "groups" with its name exactly as listed, and list only the photos to add.
  - Combine groups that are too similar to each other: list them in "merge" with the name for the combined group, one of theirs or a new one.
  - Remove a group whose photos aren't too similar after all: list it in "remove" with why. Its photos just leave the group.
  - Moving a photo out of one of my groups into another group is fine. Leave my groups as they are when they're fine.`;
}

/** The example answer, with "merge" and "remove" only when the prompt sends the groups there are. */
function answerShape(groups: ExistingGroup[]): string {
  const group = `    { "name": "Lantern Street at Dusk", "photos": ["20161216_092741", "20161216_092745", "20161218_220416"] }`;
  if (groups.length === 0) return `{\n  "groups": [\n${group}\n  ]\n}`;
  return `{
  "groups": [
${group}
  ],
  "merge": [
    { "groups": ["Harbor Boats", "Boats at the Pier"], "name": "Harbor Boats" }
  ],
  "remove": [
    { "group": "Red Doors", "reason": "The two doors are on different streets and framed differently." }
  ]
}`;
}

/**
 * The prompt to paste into a chat with an LLM, linking each photo's Small image (and the contact
 * sheets made of them, when there are any) and asking which of
 * them are too similar to all be posted, not only near duplicates, so they can be weighed
 * head-to-head in a compare group, and, when it sends them, how to change the groups there are,
 * with the answer as JSON the Autogroup page reads.
 */
export function autogroupPrompt(ask: AutogroupAsk, sheets?: ContactSheet[]): string {
  const { loose, groups } = ask;
  const order = new Map(linkedPhotos(ask).map((entry, index) => [entry.key, index]));
  const tile: TileNote = (entry) => tileNote(sheets, order.get(entry.key) ?? -1);
  const tidy =
    groups.length > 0 ? ", and tell me how to tidy the compare groups I have already" : "";
  return `Look at these photos and group the ones that are too similar to each other to all be worth posting, so I can compare each group side by side and keep only the best${tidy}.

Each photo's name is in quotes, followed by a link to a small version of it. ${lookAtPhotos(sheets, "Open every link and look at the photos themselves.")}

Photos not in a group yet (${loose.length}):

${loose.map((entry) => photoSection(entry, tile)).join("\n\n") || "None."}${groupsSection(groups, tile)}

Rules:
- I'm not only looking for duplicates. Group photos that are generally too similar: someone scrolling the portfolio would feel they'd seen it already. That includes near-identical frames, but also the same subject, scene or view shot another time or from another angle, and photos with the same composition, framing or idea, even when they were taken on different days or in different places.
- Don't group photos that only share a broad theme, a color or a place but look clearly different, such as two street photos of different scenes in the same city.
- The times they were taken can help, since photos taken close together are often similar, but look at the photos to decide.
- A group can have any number of photos, 2 or more: put every photo that's too similar to the others in the same group, however many there are. Leave out any photo that isn't too similar to another here.
- A photo goes in at most one group.
- Name each new group in a few words saying what its photos show, in Title Case, such as "Lantern Street at Dusk".${groupRules(groups)}
- Answer with only this JSON, with nothing before or after it, naming each photo and group by its name in quotes above:
${answerShape(groups)}
- Leave a list empty when there's nothing for it.`;
}

/** The JSON object in the answer, from its first `{` to its last `}`, so a code fence or a sentence around it is fine. */
export function answerObject(answer: string): unknown {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The answer has no JSON object in it.");
  try {
    return parsePastedJson(answer.slice(start, end + 1));
  } catch {
    throw new Error("The answer's JSON couldn't be read. Paste the whole answer, from { to }.");
  }
}

/** A name as the answer gave it, for looking up: no quotes, `.json` ending or case. */
export function lookupName(name: string): string {
  return name
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\.json$/i, "")
    .toLowerCase();
}

/** Looks a photo up by the name the answer gave, its JSON file's name or its original file's name. */
export function photoFinder(
  photos: AutogroupPhoto[],
): (name: string) => AutogroupPhoto | undefined {
  const byKey = new Map<string, AutogroupPhoto>();
  for (const entry of photos) {
    byKey.set(entry.key.toLowerCase(), entry);
    byKey.set(entry.photo.file.photoName.toLowerCase(), entry);
  }
  return (name) => byKey.get(lookupName(name));
}
