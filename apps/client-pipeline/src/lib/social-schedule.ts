import type { SocialPhoto } from "@/api/publish";
import type { FieldChange, LocalEdit } from "@/stores/local-edits";

/** Photo file path → its unsaved publish date; a path that's missing keeps its saved one. */
export type Unsaved = Record<string, string | null>;

/** The photo's publish date with the unsaved ones applied. */
export function dateOf(unsaved: Unsaved, photo: SocialPhoto): string | null {
  if (!(photo.path in unsaved)) return photo.socialMediaPublishDate;
  return unsaved[photo.path] ?? null;
}

/** Each scheduled day's photo. */
export function photosByDay(photos: SocialPhoto[], unsaved: Unsaved): Map<string, SocialPhoto> {
  const map = new Map<string, SocialPhoto>();
  for (const photo of photos) {
    const date = dateOf(unsaved, photo);
    if (date) map.set(date, photo);
  }
  return map;
}

/** The photo JSON field that holds the day a photo is posted, as YYYY-MM-DD. */
export const PUBLISH_DATE = "socialMediaPublishDate";

/** The publish dates among the local edits, by photo file path. */
export function unsavedFromEdits(edits: Record<string, LocalEdit>): Unsaved {
  const unsaved: Unsaved = {};
  for (const edit of Object.values(edits)) {
    if (PUBLISH_DATE in edit.fields)
      unsaved[edit.path] = edit.fields[PUBLISH_DATE] as string | null;
  }
  return unsaved;
}

/** The dates in next as local edits, one per photo next names. */
export function dateChanges(photos: SocialPhoto[], next: Unsaved): FieldChange[] {
  return photos
    .filter((photo) => photo.path in next)
    .map((photo) => ({ path: photo.path, before: photo.data, value: next[photo.path] ?? null }));
}

/**
 * The unsaved dates with photo moved to day (null takes it off the calendar). A photo already on
 * day swaps to the day photo came from.
 */
export function moveToDay(
  unsaved: Unsaved,
  byDay: Map<string, SocialPhoto>,
  photo: SocialPhoto,
  day: string | null,
): Unsaved {
  const from = dateOf(unsaved, photo);
  const next: Unsaved = { ...unsaved, [photo.path]: day };
  const occupant = day === null ? undefined : byDay.get(day);
  if (occupant && occupant.path !== photo.path) next[occupant.path] = from;
  return next;
}

/** The photo's title, or its file name without the extension. */
export function photoName(photo: SocialPhoto): string {
  return photo.title?.trim() || photo.file.replace(/\.[^.]*$/, "") || photo.path;
}

/**
 * The photos matching search, in flight ones included, and scheduled ones only with
 * showScheduled: ones eligible for social media first, then ones not scheduled yet, then by name.
 */
export function pickerChoices(
  photos: SocialPhoto[],
  unsaved: Unsaved,
  search: string,
  showScheduled: boolean,
) {
  const query = search.trim().toLowerCase();
  const matches = (photo: SocialPhoto) =>
    `${photoName(photo)} ${photo.file}`.toLowerCase().includes(query);
  const scheduled = (photo: SocialPhoto) => Number(dateOf(unsaved, photo) !== null);
  return photos
    .filter((photo) => matches(photo) && (showScheduled || !scheduled(photo)))
    .toSorted(
      (a, b) =>
        Number(b.isSocialMediaEligible) - Number(a.isSocialMediaEligible) ||
        scheduled(a) - scheduled(b) ||
        photoName(a).localeCompare(photoName(b)),
    );
}
