import type { Photo } from "@portfolio/lib/photos";
import { matchesRules, type SmartRules } from "@portfolio/lib/smart-albums";
import type { TimelineLabel } from "@portfolio/lib/timeline-labels";
import type { CombinedData } from "@/api/photos";
import { type CombinedPhoto, currentListedPhotos, currentLists } from "@/lib/group-photos";
import { labelsOf, readEntries } from "@/lib/smart-album-photos";

/**
 * The photos a Smart Album's rules are tried on: ALLPHOTOS.json as the portfolio reads it, with
 * only the albums each photo lists itself, the entry each one is, and the timeline labels.
 */
export interface RulePhotos {
  photos: Photo[];
  entries: Map<number, CombinedPhoto>;
  labels: TimelineLabel[];
}

/** The photos to try a Smart Album's rules on; undefined until ALLPHOTOS.json is read. */
export function rulePhotos(data: CombinedData | undefined): RulePhotos | undefined {
  const current = data && currentListedPhotos(data);
  if (!data || !current) return undefined;
  const labels = labelsOf(currentLists(data));
  const { photos, ids } = readEntries(current.photos, [], labels);
  const entries = new Map(ids.map((id, index) => [id, current.photos[index] as CombinedPhoto]));
  return { photos, entries, labels };
}

/** The entries whose photos match the rules, in ALLPHOTOS.json's order. */
export function entriesMatching(
  { photos, entries, labels }: RulePhotos,
  rules: SmartRules,
): CombinedPhoto[] {
  return photos
    .filter((photo) => matchesRules(photo, rules, labels))
    .flatMap((photo) => entryOf(entries, photo.id));
}

/** The entry with the ID, as a list of one, or none. */
function entryOf(entries: Map<number, CombinedPhoto>, id: number): CombinedPhoto[] {
  const entry = entries.get(id);
  return entry ? [entry] : [];
}
