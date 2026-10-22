// Helpers shared by the Gallery page and its parts, about one photo JSON file on the base branch.
import { type PublishedFile } from "@/api/photos";

/** Which photos are chosen to add albums and tags to, by path; null when not choosing. */
export type Selection = ReadonlySet<string> | null;

/** Why the photo can't have albums and tags added from here, or undefined when it can. */
export function selectProblem(file: PublishedFile): string | undefined {
  if (file.error) return "Its JSON couldn't be read.";
  if (file.inFlight === "removed") return "It's removed in the pull request.";
  return undefined;
}

/** The photo's JSON as an object, or undefined when it couldn't be read as one. */
export function fileData(file: PublishedFile): Record<string, unknown> | undefined {
  const data = file.data;
  return typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : undefined;
}

/** The photo JSON's field, trimmed, when it's a string with something in it. */
export function savedString(file: PublishedFile, field: string): string | undefined {
  const value = (file.data as Record<string, unknown> | undefined)?.[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** What to call the photo: its title, or else its original file name. */
export function photoName(file: PublishedFile): string {
  return savedString(file, "title") ?? file.photoName;
}

/** The last part of a path: the JSON file's name. */
export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
