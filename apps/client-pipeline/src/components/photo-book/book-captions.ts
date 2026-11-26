import { useMemo } from "react";
import { allOverrides } from "@/api/cameras";
import { type CaptionTemplate, captionTemplates, defaultCaptionTemplate } from "@/api/captions";
import { customLenses } from "@/api/lenses";
import type { SocialPhoto } from "@/api/publish";
import { overrideChanges } from "@/lib/camera-overrides";
import { fillTemplate } from "@/lib/caption-place-form";
import { captionLists, captionValues } from "@/lib/caption-template";
import type { BookSlot, PhotoBook } from "@/lib/photo-book";
import { type LocationPart, locationParts, withHiddenParts } from "@/lib/photo-book-hidden";
import { type LensPrefix, withStrippedLens } from "@/lib/photo-book-lenses";
import { PHOTO_BOOK_PLATFORM } from "@/lib/social-posts";
import { currentData } from "@/lib/social-schedule";
import { useChangedPhotoFiles, useCombinedData } from "@/stores/combined-data";

/**
 * The caption templates, and the one the book's captions are filled in with: the book's own, or
 * else the first one for the Photo Book, or else the first one for any platform.
 */
export function useBookTemplate(book: PhotoBook | undefined) {
  const { data } = useCombinedData();
  const templates = captionTemplates(data);
  const template =
    templates.find((t) => t.id === book?.template) ??
    defaultCaptionTemplate(templates, PHOTO_BOOK_PLATFORM.id);
  return { templates, template };
}

/**
 * A photo's fields as its caption fills them in: its data with the changes not committed yet and
 * the camera and lens overrides and custom lens made over it, even ones not applied to the photo
 * file yet.
 */
export function usePhotoFields() {
  const { data } = useCombinedData();
  const changed = useChangedPhotoFiles();
  const settings = useMemo(
    () => ({ overrides: allOverrides(data), lenses: customLenses(data) }),
    [data],
  );
  return (photo: SocialPhoto): Record<string, unknown> => {
    const saved = (currentData(photo, changed) ?? {}) as Record<string, unknown>;
    return { ...saved, ...overrideChanges(settings.overrides, settings.lenses, saved) };
  };
}

/**
 * What each photo place's caption says: the one written by hand, or else the template filled in
 * from the photo's fields (see usePhotoFields), its lens without the prefix the book takes off it
 * and without the parts of its location hidden for it in the book;
 * "" without a photo or a template.
 */
export function useCaptionFor(
  photos: Map<string, SocialPhoto>,
  template: CaptionTemplate | undefined,
  prefixes: LensPrefix[] | undefined,
) {
  const { data } = useCombinedData();
  const lists = useMemo(() => captionLists(data), [data]);
  const fieldsOf = usePhotoFields();
  const filled = (slot: BookSlot): string => {
    const photo = photos.get(slot.photo);
    if (!photo || !template) return "";
    const fields = withHiddenParts(withStrippedLens(fieldsOf(photo), prefixes), slot.hidden);
    return fillTemplate(template, captionValues(fields, lists));
  };
  return (slot: BookSlot): string => slot.caption ?? filled(slot);
}

/** The parts of each slot's photo's location its caption can leave out; none without a photo. */
export function usePartsFor(photos: Map<string, SocialPhoto>) {
  const { data } = useCombinedData();
  const lists = useMemo(() => captionLists(data), [data]);
  const fieldsOf = usePhotoFields();
  return (slot: BookSlot): LocationPart[] => {
    const photo = photos.get(slot.photo);
    return photo ? locationParts(fieldsOf(photo), lists) : [];
  };
}
