import { overrideId } from "@/api/cameras";
import { settingMutations } from "@/api/data-files";
import type { CombinedData } from "@/api/photos";

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
export function viewerLikes(data: CombinedData | undefined): ViewerLikes[] {
  const entries = data ? (data.head ?? data.base).likes.data : undefined;
  return (entries ?? []).filter(isViewer).toSorted((a, b) => a.name.localeCompare(b.name));
}

/** The ID a new person gets, such as `jane-doe`. */
export function viewerId(name: string): string {
  return overrideId(name);
}

/** What a pasted or uploaded list holds: its photo IDs, each once, and the parts that aren't IDs. */
export interface ParsedLikes {
  ids: number[];
  skipped: string[];
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
 * The photo IDs in a list sent from the portfolio's My Likes page: the comma-separated text
 * "Send to photographer" makes, such as "281, 284, 286", or a JSON array such as [281, 284].
 */
export function parseLikes(text: string): ParsedLikes {
  const ids = new Set<number>();
  const skipped: string[] = [];
  for (const part of listParts(text)) {
    if (/^\d+$/.test(part.trim()) && Number(part) > 0) ids.add(Number(part));
    else skipped.push(part);
  }
  return { ids: [...ids].toSorted((a, b) => a - b), skipped };
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
