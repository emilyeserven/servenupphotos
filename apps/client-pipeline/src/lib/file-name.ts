/**
 * A photo's title, or else its original file name without the extension, as a JSON file name the
 * backend takes, in lowercase: accents dropped, runs of spaces and dashes turned into one dash, other characters
 * it refuses taken out, and cut to its 100-character limit. Without the .json extension.
 */
export function jsonFileName(title: string | null | undefined, file: string): string {
  const name = (title?.trim() || file.replace(/\.[^.]*$/, ""))
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    // "Frogs - Agents of Chaos" makes "frogs---agents-of-chaos" so far: keep one separator.
    .replace(/-{2,}/g, "-")
    .replace(/-*([._])-*/g, "$1")
    .replace(/^[^A-Za-z0-9]+/, "")
    .slice(0, 100)
    .replace(/[.-]+$/, "");
  return name || "photo";
}

/** Matches the backend's rule for a photo JSON file name: plain file names only. */
const JSON_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/** Why name, with or without .json, can't be a photo JSON file's name, or undefined if it can. */
export function jsonNameProblem(name: string): string | undefined {
  const stem = name.trim().replace(/\.json$/, "");
  if (!JSON_NAME_PATTERN.test(stem)) {
    return "Use letters, numbers, dots, dashes and underscores, starting with a letter or number.";
  }
  return undefined;
}

/** Why name can't be a photo's name for an upload to R2, or undefined if it can. Keys keep only letters and numbers. */
export function uploadNameProblem(name: string): string | undefined {
  if (!/[a-z0-9]/i.test(name)) return "Use at least one letter or number.";
  return undefined;
}
