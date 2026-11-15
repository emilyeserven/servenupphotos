import { type ComparePhoto, compareGroupOf, comparePhotoName } from "@/lib/compare-groups";
import { isDraft, isUnselected, titleOf } from "@/lib/drafts";
import { CREATE_DATE, CUSTOM_DATE } from "@/lib/photo-fields";
import { promptImageUrl } from "@/lib/tag-prompt";

/** Which photos Autogroup asks about: every photo, or only the drafts. */
export type AutogroupScope = "all" | "drafts";

/** What Autogroup asks about: which photos, and whether photos already in a group are left out. */
export interface AutogroupOptions {
  scope: AutogroupScope;
  /** Leaves out photos already in a compare group, so only ungrouped photos are suggested. */
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

/** Whether the photo can be asked about with these options. */
function wanted(photo: ComparePhoto, options: AutogroupOptions): boolean {
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

/**
 * The photos Autogroup can ask about, oldest first: the drafts or every photo, leaving out
 * unselected photos (their images may be gone), photos without an image, and, when asked, photos
 * already in a group.
 */
export function autogroupPhotos(
  photos: ComparePhoto[],
  options: AutogroupOptions,
): AutogroupPhoto[] {
  return photos
    .filter((photo) => wanted(photo, options))
    .map((photo) => ({
      photo,
      key: autogroupKey(photo),
      imageUrl: promptImage(photo),
      takenAt: takenAt(photo.data),
    }))
    .filter((entry) => entry.imageUrl !== "")
    .toSorted(byTaken);
}

/** One photo's part of the prompt: its name and image, when it was taken, its title and group. */
function photoSection(entry: AutogroupPhoto): string {
  const lines = [`Photo "${entry.key}": ${entry.imageUrl}`];
  if (entry.takenAt) lines.push(`- Taken: ${entry.takenAt}`);
  const title = titleOf(entry.photo.data);
  if (title) lines.push(`- Title: ${title}`);
  const group = compareGroupOf(entry.photo.data);
  if (group) lines.push(`- Already in the group: ${group}`);
  return lines.join("\n");
}

/** The groups the prompt's photos are already in, one "- name" line each, or "" for none. */
function existingGroupLines(photos: AutogroupPhoto[]): string {
  const names = [
    ...new Set(photos.map((entry) => compareGroupOf(entry.photo.data)).filter(Boolean)),
  ];
  return names.map((name) => `- ${name}`).join("\n");
}

/** The rule about groups some photos are already in, when any are. */
function existingGroupsSection(photos: AutogroupPhoto[]): string {
  const lines = existingGroupLines(photos);
  if (!lines) return "";
  return `
Groups some of these photos are in already:
${lines}
To add photos to one of these groups, use its name exactly as it's listed, and list the photos already in it too.
`;
}

/**
 * The prompt to paste into a chat with an LLM, linking each photo's Small image and asking which of
 * them are too similar to all be posted, not only near duplicates, so they can be weighed head-to-head in a compare group, and for the
 * answer as JSON the Autogroup page reads.
 */
export function autogroupPrompt(photos: AutogroupPhoto[]): string {
  return `Look at these ${photos.length} photos and group the ones that are too similar to each other to all be worth posting, so I can compare each group side by side and keep only the best.

Each photo's name is in quotes, followed by a link to a small version of it. Open every link and look at the photos themselves.

${photos.map(photoSection).join("\n\n")}
${existingGroupsSection(photos)}
Rules:
- I'm not only looking for duplicates. Group photos that are generally too similar: someone scrolling the portfolio would feel they'd seen it already. That includes near-identical frames, but also the same subject, scene or view shot another time or from another angle, and photos with the same composition, framing or idea, even when they were taken on different days or in different places.
- Don't group photos that only share a broad theme, a color or a place but look clearly different, such as two street photos of different scenes in the same city.
- The times they were taken can help, since photos taken close together are often similar, but look at the photos to decide.
- A group can have any number of photos, 2 or more: put every photo that's too similar to the others in the same group, however many there are. Leave out any photo that isn't too similar to another here.
- A photo goes in at most one group.
- Name each group in a few words saying what its photos show, in Title Case, such as "Lantern Street at Dusk".
- Answer with only this JSON, with nothing before or after it, listing each photo by its name in quotes above:
{
  "groups": [
    { "name": "Lantern Street at Dusk", "photos": ["20161216_092741", "20161216_092745", "20161218_220416"] }
  ]
}
- Answer with { "groups": [] } when no photos belong together.`;
}

/** A group the LLM suggested, with the photos the page knows by name. */
export interface AutogroupSuggestion {
  name: string;
  photos: AutogroupPhoto[];
  /** True when a group by this name exists already, so the photos join it. */
  existing: boolean;
}

/** The LLM's answer as the page reads it: the groups, and the names it gave that aren't photos here. */
export interface AutogroupAnswer {
  groups: AutogroupSuggestion[];
  unknown: string[];
}

/** The JSON object in the answer, from its first `{` to its last `}`, so a code fence or a sentence around it is fine. */
function answerObject(answer: string): unknown {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The answer has no JSON object in it.");
  try {
    return JSON.parse(answer.slice(start, end + 1));
  } catch {
    throw new Error("The answer's JSON couldn't be read. Paste the whole answer, from { to }.");
  }
}

/** A group as the answer gives it, before its photos are looked up. */
interface RawGroup {
  name: string;
  photos: string[];
}

/** The answer's groups that have a name and a list of photo names. */
function rawGroups(parsed: unknown): RawGroup[] {
  const groups = (parsed as { groups?: unknown } | null)?.groups;
  if (!Array.isArray(groups)) throw new Error('The answer\'s JSON has no "groups" list.');
  return groups
    .map((group) => group as { name?: unknown; photos?: unknown })
    .filter((group) => typeof group?.name === "string" && group.name.trim() !== "")
    .map((group) => ({
      name: (group.name as string).trim(),
      photos: Array.isArray(group.photos)
        ? group.photos.filter((name): name is string => typeof name === "string")
        : [],
    }));
}

/** Looks a photo up by the name the answer gave, ignoring case, quotes and a `.json` ending. */
function photoFinder(photos: AutogroupPhoto[]): (name: string) => AutogroupPhoto | undefined {
  const byKey = new Map<string, AutogroupPhoto>();
  for (const entry of photos) {
    byKey.set(entry.key.toLowerCase(), entry);
    byKey.set(entry.photo.file.photoName.toLowerCase(), entry);
  }
  return (name) =>
    byKey.get(
      name
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/\.json$/i, "")
        .toLowerCase(),
    );
}

/** How many photos are in the group named name already, other than the ones suggested for it. */
function othersInGroup(all: ComparePhoto[], name: string, suggested: AutogroupPhoto[]): number {
  const paths = new Set(suggested.map((entry) => entry.photo.file.path));
  return all.filter((photo) => compareGroupOf(photo.data) === name && !paths.has(photo.file.path))
    .length;
}

/**
 * The photos named, looked up with find, leaving out ones already in `taken` (and adding the rest
 * to it), and adding names that aren't photos here to `unknown`.
 */
function groupMembers(
  names: string[],
  find: (name: string) => AutogroupPhoto | undefined,
  taken: Set<string>,
  unknown: Set<string>,
): AutogroupPhoto[] {
  const members: AutogroupPhoto[] = [];
  for (const name of names) {
    const entry = find(name);
    if (!entry) unknown.add(name);
    else if (!taken.has(entry.key)) {
      taken.add(entry.key);
      members.push(entry);
    }
  }
  return members;
}

/**
 * Reads the LLM's answer into the groups to make, looking each photo up among the prompt's photos.
 * A photo named in more than one group stays in the first; a group left with fewer than 2 photos,
 * counting the ones in it already, is dropped. Throws an error a user can read when the answer
 * isn't the JSON the prompt asks for.
 */
export function readAutogroupAnswer(
  answer: string,
  photos: AutogroupPhoto[],
  all: ComparePhoto[],
): AutogroupAnswer {
  const find = photoFinder(photos);
  const taken = new Set<string>();
  const unknown = new Set<string>();
  const groups: AutogroupSuggestion[] = [];
  for (const raw of rawGroups(answerObject(answer))) {
    const members = groupMembers(raw.photos, find, taken, unknown);
    const others = othersInGroup(all, raw.name, members);
    if (members.length > 0 && members.length + others >= 2) {
      groups.push({ name: raw.name, photos: members, existing: others > 0 });
    }
  }
  return { groups, unknown: [...unknown] };
}

/** The photos of the suggestion that would move out of another group, with that group's name. */
export function movingPhotos(suggestion: AutogroupSuggestion): { name: string; from: string }[] {
  return suggestion.photos.flatMap((entry) => {
    const from = compareGroupOf(entry.photo.data);
    return from && from !== suggestion.name ? [{ name: comparePhotoName(entry.photo), from }] : [];
  });
}
