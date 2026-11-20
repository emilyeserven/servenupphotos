import {
  type AutogroupAsk,
  type AutogroupPhoto,
  type ExistingGroup,
  answerObject as jsonObject,
  answerablePhotos,
  existingGroups,
  lookupName,
  photoFinder,
} from "@/lib/compare-autogroup";
import { type ComparePhoto, compareGroupOf, comparePhotoName } from "@/lib/compare-groups";

/** A group the LLM suggested making, or photos it suggested adding to a group there is. */
export interface AutogroupSuggestion {
  name: string;
  photos: AutogroupPhoto[];
  /** True when a group by this name exists already, so the photos join it. */
  existing: boolean;
}

/** Groups there are that the LLM suggested combining into one. */
export interface AutogroupMerge {
  /** The combined group's name: one of theirs or a new one. */
  name: string;
  groups: ExistingGroup[];
}

/** A group there is that the LLM suggested removing, so its photos leave it. */
export interface AutogroupRemoval {
  group: ExistingGroup;
  /** Why, as the LLM put it, or "" when it didn't say. */
  reason: string;
}

/** The LLM's answer as the page reads it, with the photo and group names it gave that aren't in the prompt. */
export interface AutogroupAnswer {
  groups: AutogroupSuggestion[];
  merges: AutogroupMerge[];
  removals: AutogroupRemoval[];
  /** Photo names that aren't any photo's, which are skipped. */
  unknown: string[];
  /** Group names to combine or remove that aren't any group's, which are skipped. */
  unknownGroups: string[];
}

/** The answer's JSON object, which has to have at least one of the lists the prompt asks for. */
function answerObject(answer: string): Record<string, unknown> {
  const lists = jsonObject(answer) as Record<string, unknown> | null;
  if (!["groups", "merge", "remove"].some((key) => Array.isArray(lists?.[key]))) {
    throw new Error('The answer\'s JSON has no "groups", "merge" or "remove" list.');
  }
  return lists as Record<string, unknown>;
}

/** The answer's list under key, each entry as an object, or none. */
function entries(parsed: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const list = parsed[key];
  return Array.isArray(list)
    ? list.filter((item): item is Record<string, unknown> => typeof item === "object" && !!item)
    : [];
}

/** The value as trimmed text, or "" when it isn't text. */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The value's text items, or none when it isn't a list. */
function texts(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

/** Looks a group there is up by the name the answer gave, ignoring case and quotes. */
function groupFinder(groups: ExistingGroup[]): (name: string) => ExistingGroup | undefined {
  const byName = new Map(groups.map((group) => [lookupName(group.name), group]));
  return (name) => byName.get(lookupName(name));
}

/** What reading the answer has found so far: the photos placed and the names it didn't know. */
interface Reading {
  findPhoto: (name: string) => AutogroupPhoto | undefined;
  findGroup: (name: string) => ExistingGroup | undefined;
  /** The keys of photos already put in a suggested group, which stay in the first. */
  taken: Set<string>;
  unknown: Set<string>;
  unknownGroups: Set<string>;
}

/** The photos named, leaving out ones already placed (and marking the rest placed) and noting unknown names. */
function groupMembers(names: string[], reading: Reading): AutogroupPhoto[] {
  const members: AutogroupPhoto[] = [];
  for (const name of names) {
    const entry = reading.findPhoto(name);
    if (!entry) reading.unknown.add(name);
    else if (!reading.taken.has(entry.key)) {
      reading.taken.add(entry.key);
      members.push(entry);
    }
  }
  return members;
}

/** How many photos are in the group named name already, other than the ones suggested for it. */
function othersInGroup(all: ComparePhoto[], name: string, suggested: AutogroupPhoto[]): number {
  const paths = new Set(suggested.map((entry) => entry.photo.file.path));
  return all.filter((photo) => compareGroupOf(photo.data) === name && !paths.has(photo.file.path))
    .length;
}

/** The groups to make or add to, dropping any left with fewer than 2 photos, counting the ones in it already. */
function readGroups(
  parsed: Record<string, unknown>,
  reading: Reading,
  all: ComparePhoto[],
): AutogroupSuggestion[] {
  const groups: AutogroupSuggestion[] = [];
  for (const raw of entries(parsed, "groups")) {
    const typed = text(raw.name);
    if (!typed) continue;
    // A group there is keeps its name as it's saved, whatever its case in the answer.
    const name = reading.findGroup(typed)?.name ?? typed;
    const members = groupMembers(texts(raw.photos), reading);
    const others = othersInGroup(all, name, members);
    if (members.length > 0 && members.length + others >= 2) {
      groups.push({ name, photos: members, existing: others > 0 });
    }
  }
  return groups;
}

/** The groups there are by the names given, noting names that aren't groups, each once. */
function knownGroups(names: string[], reading: Reading): ExistingGroup[] {
  const found = new Map<string, ExistingGroup>();
  for (const name of names) {
    const group = reading.findGroup(name);
    if (group) found.set(group.name, group);
    else reading.unknownGroups.add(name);
  }
  return [...found.values()];
}

/** The groups to combine, each with at least 2 groups there are and no group in an earlier one. */
function readMerges(parsed: Record<string, unknown>, reading: Reading): AutogroupMerge[] {
  const merged = new Set<string>();
  const merges: AutogroupMerge[] = [];
  for (const raw of entries(parsed, "merge")) {
    const groups = knownGroups(texts(raw.groups), reading).filter((g) => !merged.has(g.name));
    if (groups.length < 2) continue;
    for (const group of groups) merged.add(group.name);
    const name = text(raw.name);
    merges.push({
      name: reading.findGroup(name)?.name ?? (name || (groups[0]?.name ?? "")),
      groups,
    });
  }
  return merges;
}

/** The groups to remove, leaving out any being combined, each once. */
function readRemovals(
  parsed: Record<string, unknown>,
  reading: Reading,
  merges: AutogroupMerge[],
): AutogroupRemoval[] {
  const skip = new Set(merges.flatMap((merge) => merge.groups.map((group) => group.name)));
  const removals: AutogroupRemoval[] = [];
  for (const raw of entries(parsed, "remove")) {
    const [group] = knownGroups([text(raw.group)].filter(Boolean), reading);
    if (!group || skip.has(group.name)) continue;
    skip.add(group.name);
    removals.push({ group, reason: text(raw.reason) });
  }
  return removals;
}

/**
 * Reads the LLM's answer into the groups to make or add to, the groups to combine and the groups
 * to remove, looking each photo and group up among every photo and group, not only the prompt's,
 * so an answer written for another prompt still applies. A photo named in more than one
 * group stays in the first; a group left with fewer than 2 photos, counting the ones in it already,
 * is dropped; a group being combined isn't also removed. Throws an error a user can read when the
 * answer isn't the JSON the prompt asks for.
 */
export function readAutogroupAnswer(
  answer: string,
  ask: AutogroupAsk,
  all: ComparePhoto[],
): AutogroupAnswer {
  const parsed = answerObject(answer);
  const reading: Reading = {
    findPhoto: photoFinder(answerablePhotos(ask, all)),
    findGroup: groupFinder(ask.groups.length > 0 ? ask.groups : existingGroups(all)),
    taken: new Set(),
    unknown: new Set(),
    unknownGroups: new Set(),
  };
  const groups = readGroups(parsed, reading, all);
  const merges = readMerges(parsed, reading);
  const removals = readRemovals(parsed, reading, merges);
  return {
    groups,
    merges,
    removals,
    unknown: [...reading.unknown],
    unknownGroups: [...reading.unknownGroups],
  };
}

/** The photos of the suggestion that would move out of another group, with that group's name. */
export function movingPhotos(suggestion: AutogroupSuggestion): { name: string; from: string }[] {
  return suggestion.photos.flatMap((entry) => {
    const from = compareGroupOf(entry.photo.data);
    return from && from !== suggestion.name ? [{ name: comparePhotoName(entry.photo), from }] : [];
  });
}

/** How many changes of the answer are kept: groups made or added to, combinations and removals. */
export function changeCount(answer: AutogroupAnswer): number {
  return answer.groups.length + answer.merges.length + answer.removals.length;
}
