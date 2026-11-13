import { LOWER_TIER } from "@/lib/photo-fields";
import { editedData } from "@/lib/undecided";
import type { LocalEdit } from "@/stores/local-edits";

/** A photo file as the Lower Tier filter reads it. */
interface PhotoFile {
  path: string;
  data?: unknown;
  error?: string;
}

/** Whether a photo's JSON is marked Lower Tier: its `lowerTier` is `true`. */
export function isLowerTier(data: unknown): boolean {
  return (data as Record<string, unknown> | null | undefined)?.[LOWER_TIER] === true;
}

/** The paths of the Lower Tier photos among files, with the local edits made. */
export function lowerTierPaths(
  files: PhotoFile[],
  edits: Record<string, LocalEdit>,
): ReadonlySet<string> {
  return new Set(
    files
      .filter((file) => !file.error && isLowerTier(editedData(file, edits)))
      .map((file) => file.path),
  );
}
