/**
 * A photo's title, or else its original file name without the extension, as a JSON file name the
 * backend takes, in lowercase: accents dropped, runs of spaces turned into one dash, other characters
 * it refuses taken out, and cut to its 100-character limit. Without the .json extension.
 */
export function jsonFileName(title: string | null | undefined, file: string): string {
  const name = (title?.trim() || file.replace(/\.[^.]*$/, ""))
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[^A-Za-z0-9]+/, "")
    .slice(0, 100)
    .replace(/[.-]+$/, "");
  return name || "photo";
}
