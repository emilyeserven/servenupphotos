import { LOWER_TIER } from "@/lib/photo-fields";
import { editedData } from "@/lib/undecided";
import type { LocalEdit } from "@/stores/local-edits";

/** A photo file as the Lower Tier mark reads it. */
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

/**
 * data with the Lower Tier mark set (`true`) or taken off (`null`), as the Photo page's Save changes
 * writes it. Off on a file that never had the field leaves it out, so saving doesn't add a `null`.
 */
export function withLowerTier<T extends Record<string, unknown>>(data: T, lowerTier: boolean): T {
  if (lowerTier) return { ...data, [LOWER_TIER]: true };
  return data[LOWER_TIER] === undefined ? data : { ...data, [LOWER_TIER]: null };
}

/**
 * data with the Lower Tier mark waiting for Commit in fields (a local edit, such as one set in the
 * Gallery or on the Compare page) made over it, so the Photo page starts from it; data as it is
 * when fields don't change the mark.
 */
export function withLocalLowerTier<T extends Record<string, unknown>>(
  data: T,
  fields: Record<string, unknown> | undefined,
): T {
  if (!fields || !(LOWER_TIER in fields)) return data;
  return { ...data, [LOWER_TIER]: fields[LOWER_TIER] };
}
