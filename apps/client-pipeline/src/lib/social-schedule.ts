import type { SocialPhoto } from "@/api/publish";

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

/** The unsaved dates that differ from the saved ones, to send to the backend. */
export function unsavedChanges(photos: SocialPhoto[], unsaved: Unsaved) {
  return photos
    .filter((photo) => dateOf(unsaved, photo) !== photo.socialMediaPublishDate)
    .map((photo) => ({ path: photo.path, date: dateOf(unsaved, photo) }));
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
 * The photos matching search, in flight ones included: ones eligible for social media first, then
 * ones not scheduled yet, then by name.
 */
export function pickerChoices(photos: SocialPhoto[], unsaved: Unsaved, search: string) {
  const query = search.trim().toLowerCase();
  const matches = (photo: SocialPhoto) =>
    `${photoName(photo)} ${photo.file}`.toLowerCase().includes(query);
  const scheduled = (photo: SocialPhoto) => Number(dateOf(unsaved, photo) !== null);
  return photos
    .filter(matches)
    .toSorted(
      (a, b) =>
        Number(b.isSocialMediaEligible) - Number(a.isSocialMediaEligible) ||
        scheduled(a) - scheduled(b) ||
        photoName(a).localeCompare(photoName(b)),
    );
}
