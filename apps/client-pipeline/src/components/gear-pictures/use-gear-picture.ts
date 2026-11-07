import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { GearCrop, GearFile } from "@portfolio/lib/gear-pictures";
import { cropGearImageMutation, type UploadedGearOriginal } from "@/api/gear";
import { wholeCrop } from "@/lib/gear-crop";

/** A gear picture being edited: its crop's link, its original's, and the crops wanted and shown. */
export interface GearPictureState {
  /** The link of the crop the portfolio will show, or "" for the drawing. */
  image: string;
  /** The link of the picture as uploaded, which crops are cut from, or "". */
  original: string;
  /** The crop being lined up, which may not be cut yet. */
  crop?: GearCrop;
  /** The crop `image` shows, once one has been cut. */
  applied?: GearCrop;
}

/** The saved file's picture: its crop and original, or its picture alone from before crops. */
function savedPicture(file?: GearFile): GearPictureState {
  return file ? fromFile(file) : { image: "", original: "" };
}

function fromFile({ image, original, crop }: GearFile): GearPictureState {
  return { image, original: original ?? image, crop, applied: crop };
}

/**
 * A camera's or lens's picture while it's edited, starting from its saved file, with what can be
 * done to it: take an upload (cutting the whole picture as its first crop), line up a crop, cut
 * the crop lined up, or go back to the drawing.
 */
export function useGearPicture(file?: GearFile) {
  const [picture, setPicture] = useState(() => savedPicture(file));
  const cut = useMutation(cropGearImageMutation);
  const apply = (original: string, crop: GearCrop) =>
    cut.mutate(
      { original, crop },
      { onSuccess: (res) => setPicture((p) => ({ ...p, image: res.url, applied: crop })) },
    );
  return {
    picture,
    cut,
    /** Takes a new upload, and cuts the whole of it as its first crop. */
    uploaded: (res: UploadedGearOriginal) => {
      const crop = wholeCrop(res.width, res.height);
      setPicture((p) => ({ ...p, original: res.url, crop }));
      apply(res.url, crop);
    },
    /** Lines up a new crop, not cut yet. */
    setCrop: (crop: GearCrop) => setPicture((p) => ({ ...p, crop })),
    /** Cuts the crop lined up. */
    applyCrop: () => picture.crop && apply(picture.original, picture.crop),
    /** Goes back to the drawing. */
    clear: () => setPicture({ image: "", original: "" }),
  };
}

/** The editor's picture: what useGearPicture gives. */
export type GearPictureEditor = ReturnType<typeof useGearPicture>;
