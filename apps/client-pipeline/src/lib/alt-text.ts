/**
 * How many characters alt text reads best within: about what a screen reader says in one breath.
 * Longer alt text can still be saved; the pipeline only marks it.
 */
export const ALT_TEXT_TARGET = 125;

/** The most characters alt text can have, as the backend allows. */
export const ALT_TEXT_MAX = 1000;

/** How many characters the alt text has, once trimmed, counting each emoji or accented letter once. */
export function altTextLength(value: string): number {
  return [...value.trim()].length;
}

/** One photo's alt text in the review: the text, as the answer gave it or as edited, and whether it's saved. */
export interface AltTextDraft {
  text: string;
  ticked: boolean;
}

/** Each suggested photo's draft, by path, ticked when the answer gave it alt text. */
export function startingDrafts(
  photos: readonly { path: string; altText: string }[],
): Record<string, AltTextDraft> {
  return Object.fromEntries(
    photos.map((photo) => [
      photo.path,
      { text: photo.altText, ticked: photo.altText.trim() !== "" },
    ]),
  );
}

/** What to save from the review: each ticked photo with alt text, trimmed. */
export function altTextsToSave(drafts: Record<string, AltTextDraft>) {
  return {
    photos: Object.entries(drafts)
      .filter(([, draft]) => draft.ticked && draft.text.trim() !== "")
      .map(([path, draft]) => ({ path, altText: draft.text.trim() })),
  };
}
