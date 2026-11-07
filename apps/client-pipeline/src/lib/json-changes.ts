import { diffLines } from "@/lib/line-diff";

/** How many lines a file's JSON adds and removes. */
export interface LineChanges {
  added: number;
  removed: number;
}

/** The JSON as the diff shows it, pretty-printed, as lines. */
function jsonLines(value: unknown): string[] {
  return (JSON.stringify(value, null, 2) ?? "").split("\n");
}

/**
 * How many lines the file's JSON adds and removes against its copy on the base branch, the way its
 * diff counts them; every line is added when the base branch doesn't have it. Undefined when the
 * file couldn't be read.
 */
export function lineChanges(file: {
  data?: unknown;
  base?: unknown;
  error?: string;
}): LineChanges | undefined {
  if (file.error || file.data === undefined) return undefined;
  if (file.base === undefined) return { added: jsonLines(file.data).length, removed: 0 };
  const lines = diffLines(jsonLines(file.base), jsonLines(file.data));
  return {
    added: lines.filter((line) => line.kind === "added").length,
    removed: lines.filter((line) => line.kind === "removed").length,
  };
}
