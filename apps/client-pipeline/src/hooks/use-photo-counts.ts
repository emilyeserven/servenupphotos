import type { GroupKind } from "@/api/organize";
import { currentPhotos, photoCounts } from "@/lib/group-photos";
import { useCombinedData } from "@/stores/combined-data";

/** How many photos in ALLPHOTOS.json list an album, tag or genre, by ID; undefined until it's read. */
export function usePhotoCounts(kind: GroupKind): ((id: string) => number) | undefined {
  const combined = useCombinedData();
  const current = combined.data ? currentPhotos(combined.data) : undefined;
  if (!current) return undefined;
  const counts = photoCounts(current.photos, kind);
  return (id) => counts.get(id) ?? 0;
}
