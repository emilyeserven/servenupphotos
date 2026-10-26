import { ZonePreview } from "@/components/zone-preview";
import { type CombinedPhoto, currentPhotos, photoText } from "@/lib/group-photos";
import { resizedPhoto } from "@/lib/spotlight-focus";
import { useCombinedData } from "@/stores/combined-data";

/** How many of the newest photos the homepage shows with no album picked. */
const NEWEST_COUNT = 5;

/** The newest photos with resized versions, as many as the homepage shows with no album picked. */
function newestPhotos(photos: CombinedPhoto[]): CombinedPhoto[] {
  return photos
    .filter((photo) => resizedPhoto(photo) !== undefined)
    .toSorted((a, b) =>
      (photoText(b, "createDate") ?? "").localeCompare(photoText(a, "createDate") ?? ""),
    )
    .slice(0, NEWEST_COUNT);
}

/** A preview of the photos the homepage shows while no album is picked for it: the newest ones. */
export function NewestPreview() {
  const combined = useCombinedData();
  const current = combined.data ? currentPhotos(combined.data) : undefined;
  return current ? <ZonePreview photos={newestPhotos(current.photos)} /> : null;
}
