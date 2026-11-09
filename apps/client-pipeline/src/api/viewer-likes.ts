import { overrideId } from "@/api/cameras";
import { byName, settingEntries, settingMutations } from "@/api/data-files";

/**
 * A viewer likes file: one person and the photos they liked on the portfolio's My Likes page and
 * sent with "Send to photographer". Importing their list again replaces it. Commit combines them
 * into LIKES.json.
 */
export interface ViewerLikes {
  /** Made from the name when the person is added, and kept after that. */
  id: string;
  /** Who sent the list, such as "Jane". */
  name: string;
  /** The IDs of the photos they liked, lowest first. */
  photos: number[];
  /** When the list was last imported, as a UTC time; set by the pipeline when it's saved. */
  importedAt?: string;
}

function isViewer(value: unknown): value is ViewerLikes {
  const viewer = value as Partial<ViewerLikes> | null;
  return typeof viewer?.name === "string" && Array.isArray(viewer.photos);
}

/** The people who sent likes, as the next Commit will have them: LIKES.json with the changes since, by name. */
export const viewerLikes = settingEntries("likes", isViewer, byName);

/** The ID a new person gets, such as `jane-doe`. */
export function viewerId(name: string): string {
  return overrideId(name);
}

/** What a pasted or uploaded list holds: its photo IDs, each once, and the parts that aren't IDs. */
export interface ParsedLikes {
  ids: number[];
  skipped: string[];
  /** True when the IDs came from photo links, so titles and comments around them were ignored. */
  fromLinks: boolean;
}

/** A portfolio photo link's ID: `/photos/281/` or `?photo=281`. */
const PHOTO_LINK = /\/photos\/(\d+)(?=[/?#)\s]|$)|[?&]photo=(\d+)/g;

/** The photo IDs in the text's portfolio photo links, in order, such as the Markdown My Likes makes for Discord. */
function linkIds(text: string): number[] {
  return [...text.matchAll(PHOTO_LINK)].map((m) => Number(m[1] ?? m[2]));
}

/** ids sorted, each once, without any below 1. */
function sortedIds(ids: Iterable<number>): number[] {
  return [...new Set(ids)].filter((id) => id > 0).toSorted((a, b) => a - b);
}

/** A list's parts: a JSON array's items, or else the text split at commas and spaces. */
function listParts(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Not JSON after all: read it as text, so "[12, 3" still gives its IDs.
    }
  }
  return trimmed.split(/[\s,;[\]"]+/).filter(Boolean);
}

/**
 * The photo IDs in a list sent from the portfolio's My Likes page. With photo links in it, such as
 * the Markdown list "- [Castle Door](https://servenupphotos.net/photos/284/)" made for Discord, the
 * IDs are read from the links and the titles and comments are ignored. Otherwise it's the
 * comma-separated text made for Messenger or a text, such as "281, 284, 286", or a JSON array such
 * as [281, 284].
 */
export function parseLikes(text: string): ParsedLikes {
  const linked = linkIds(text);
  if (linked.length > 0) return { ids: sortedIds(linked), skipped: [], fromLinks: true };
  return { ...parseIdList(text), fromLinks: false };
}

/** The IDs in comma-separated text or a JSON array, and the parts that aren't IDs. */
function parseIdList(text: string): Omit<ParsedLikes, "fromLinks"> {
  const parts = listParts(text);
  const isId = (part: string) => /^\d+$/.test(part.trim()) && Number(part) > 0;
  return {
    ids: sortedIds(parts.filter(isId).map(Number)),
    skipped: parts.filter((part) => !isId(part)),
  };
}

/** How many people liked each photo, by photo ID. */
export function likeCounts(viewers: ViewerLikes[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of viewers.flatMap((viewer) => viewer.photos))
    counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** When a person's list was imported, such as "Imported Nov 3, 2026", or "Not imported yet" while it waits for its save. */
export function importedText(importedAt: string | undefined): string {
  if (!importedAt) return "Not imported yet";
  const date = new Date(importedAt);
  if (Number.isNaN(date.getTime())) return "Not imported yet";
  return `Imported ${date.toLocaleDateString(undefined, { dateStyle: "medium" })}`;
}

const viewerMutations = settingMutations<ViewerLikes>("likes");

/** Saves a person's likes, replacing the list they sent before, as a change waiting for Commit. */
export const saveViewerMutation = viewerMutations.save;

/** Removes a person and their likes, as a change waiting for Commit. */
export const deleteViewerMutation = viewerMutations.remove;
