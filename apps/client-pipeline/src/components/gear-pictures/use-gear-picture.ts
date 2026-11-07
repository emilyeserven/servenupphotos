import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { GearBox, GearCrop, GearFile } from "@portfolio/lib/gear-pictures";
import { cropGearImageMutation, type UploadedGearOriginal } from "@/api/gear";
import { cropLimits } from "@/components/gear-pictures/crop-limits";
import { fitCrop } from "@/lib/gear-crop";

/** A gear picture being edited: its crop's link, its original's, and the crop's place in it. */
export interface GearPictureState {
  /** The link of the crop the portfolio will show, or "" for the drawing. */
  image: string;
  /** The link of the picture as uploaded, which crops are cut from, or "". */
  original: string;
  /** The part of `original` that `image` shows, once a crop has been cut from it. */
  crop?: GearCrop;
  /** The box around the gear in `original`, when it was found on upload. */
  subject?: GearBox;
}

/** The saved file's picture: its crop and original, or its picture alone from before crops. */
function savedPicture(file?: GearFile): GearPictureState {
  return file ? fromFile(file) : { image: "", original: "" };
}

function fromFile({ image, original, crop, subject }: GearFile): GearPictureState {
  return { image, original: original ?? image, crop, subject };
}

/**
 * A camera's or lens's picture while it's edited, starting from its saved file, with what can be
 * done to it: take an upload (cutting its gear, fitted inside the limit lines, as its crop), or go
 * back to the drawing. Crops are lined up afterwards, for every picture at once, in the Crops card.
 */
export function useGearPicture(file?: GearFile) {
  const [picture, setPicture] = useState(() => savedPicture(file));
  const cut = useMutation(cropGearImageMutation);
  return {
    picture,
    cut,
    /** Takes a new upload, and cuts its gear fitted inside the limit lines as its crop. */
    uploaded: (res: UploadedGearOriginal) => {
      const crop = fitCrop(res.subject, [res.width, res.height], cropLimits.get());
      const { url: original, subject } = res;
      cut.mutate(
        { original, crop },
        { onSuccess: (cropped) => setPicture({ image: cropped.url, original, crop, subject }) },
      );
    },
    /** Goes back to the drawing. */
    clear: () => setPicture({ image: "", original: "" }),
  };
}

/** The editor's picture: what useGearPicture gives. */
export type GearPictureEditor = ReturnType<typeof useGearPicture>;
