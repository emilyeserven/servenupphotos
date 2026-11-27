import { useMemo } from "react";
import { allOverrides } from "@/api/cameras";
import { type CaptionTemplate, captionTemplates, defaultCaptionTemplate } from "@/api/captions";
import { customLenses } from "@/api/lenses";
import type { SocialPhoto } from "@/api/publish";
import { overrideChanges } from "@/lib/camera-overrides";
import { fillTemplate } from "@/lib/caption-place-form";
import { captionLists, captionValues } from "@/lib/caption-template";
import type { BookSlot, PhotoBook } from "@/lib/photo-book";
import { withBookCameraName } from "@/lib/photo-book-cameras";
import { bookCaption, templateHasTitle } from "@/lib/photo-book-caption-titles";
import {
  type LocationPart,
  captionLineParts,
  locationParts,
  withHiddenParts,
} from "@/lib/photo-book-hidden";
import { withStrippedLens } from "@/lib/photo-book-lenses";
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

/** How a book's captions name cameras and lenses and whether they have titles, set on its Info tab. */
type BookNames = Pick<PhotoBook, "cameraNames" | "lensPrefixes" | "noCaptionTitles">;

/** A photo's fields with its camera called what the book calls it and its lens without its prefix. */
function bookFields(fields: Record<string, unknown>, names: BookNames): Record<string, unknown> {
  return withStrippedLens(withBookCameraName(fields, names.cameraNames), names.lensPrefixes);
}

/** A photo place's template caption, and whether it starts with the photo's title. */
interface TemplateCaption {
  text: string;
  titled: boolean;
}

/**
 * The template filled in for each photo place from the photo's fields (see usePhotoFields), with its
 * camera and lens as the book names them (see bookFields) and without the parts of its location
 * hidden for it in the book, its hidden lines still in, and whether it starts with a title (see
 * templateHasTitle); "" without a photo or a template.
 */
function useTemplateCaption(
  photos: Map<string, SocialPhoto>,
  template: CaptionTemplate | undefined,
  names: BookNames,
) {
  const { data } = useCombinedData();
  const lists = useMemo(() => captionLists(data), [data]);
  const fieldsOf = usePhotoFields();
  return (slot: BookSlot): TemplateCaption => {
    const photo = photos.get(slot.photo);
    if (!photo || !template) return { text: "", titled: false };
    const fields = withHiddenParts(bookFields(fieldsOf(photo), names), slot.hidden);
    const values = captionValues(fields, lists);
    return { text: fillTemplate(template, values), titled: templateHasTitle(template, values) };
  };
}

/**
 * What each photo place's caption says: the one written by hand, or else the template's (see
 * useTemplateCaption) without the lines hidden for it in the book, and with its first line blank
 * when it has no title (see bookCaption).
 */
export function useCaptionFor(
  photos: Map<string, SocialPhoto>,
  template: CaptionTemplate | undefined,
  names: BookNames,
) {
  const filled = useTemplateCaption(photos, template, names);
  return (slot: BookSlot): string => {
    if (slot.caption !== null) return slot.caption;
    const { text, titled } = filled(slot);
    return bookCaption(text, {
      titled,
      hidden: slot.hidden,
      noCaptionTitles: names.noCaptionTitles,
    });
  };
}

/**
 * The parts of each slot's photo's location its caption can leave out, then the lines of its
 * template's caption; none without a photo.
 */
export function usePartsFor(
  photos: Map<string, SocialPhoto>,
  template: CaptionTemplate | undefined,
  names: BookNames,
) {
  const { data } = useCombinedData();
  const lists = useMemo(() => captionLists(data), [data]);
  const fieldsOf = usePhotoFields();
  const filled = useTemplateCaption(photos, template, names);
  return (slot: BookSlot): LocationPart[] => {
    const photo = photos.get(slot.photo);
    if (!photo) return [];
    const { text, titled } = filled(slot);
    return [...locationParts(fieldsOf(photo), lists), ...captionLineParts(text, titled)];
  };
}
