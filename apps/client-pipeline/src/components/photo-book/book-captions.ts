import { useMemo } from "react";
import { type CaptionTemplate, captionTemplates, defaultCaptionTemplate } from "@/api/captions";
import type { SocialPhoto } from "@/api/publish";
import { captionLists, captionValues, fillCaption } from "@/lib/caption-template";
import type { BookSlot, PhotoBook } from "@/lib/photo-book";
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
 * What each photo place's caption says: the one written by hand, or else the template filled in
 * from the photo's data with the changes not committed yet; "" without a photo or a template.
 */
export function useCaptionFor(
  photos: Map<string, SocialPhoto>,
  template: CaptionTemplate | undefined,
) {
  const { data } = useCombinedData();
  const changed = useChangedPhotoFiles();
  const lists = useMemo(() => captionLists(data), [data]);
  const filled = (photo: SocialPhoto | undefined): string => {
    if (!photo || !template) return "";
    const fields = (currentData(photo, changed) ?? {}) as Record<string, unknown>;
    return fillCaption(template.template, captionValues(fields, lists));
  };
  return (slot: BookSlot): string => slot.caption ?? filled(photos.get(slot.photo));
}
