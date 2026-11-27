import { isObject, textOf } from "@portfolio/lib/values";

/**
 * Where a photo's original JPEG downloads from, by its photo JSON: the pipeline's own route, which
 * names the file after the photo (its `file`), since a browser won't download straight from R2's
 * address. Undefined when the JSON has no R2 key for it.
 */
export function originalHref(data: Record<string, unknown>): string | undefined {
  const key = isObject(data.images) ? textOf(data.images.key) : "";
  if (!key) return undefined;
  const params = new URLSearchParams({ key });
  const name = textOf(data.file);
  if (name) params.set("name", name);
  return `/api/photos/original?${params}`;
}
