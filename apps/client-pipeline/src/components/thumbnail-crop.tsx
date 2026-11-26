import { useEffect, useState } from "react";
import { THUMBNAIL } from "@/api/versions";
import { CropBox, CropFrame, placement } from "@/components/thumbnail-crop/crop-box";
import { OverlayToggles, useOverlays } from "@/components/thumbnail-crop/crop-overlays";
import { CropSummary } from "@/components/thumbnail-crop/crop-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useObjectUrl } from "@/hooks/use-object-url";
import { type Crop, type Size, centerCrop } from "@/lib/crop";

interface ThumbnailCropProps {
  /** The chosen photo, or the URL of one already in R2. */
  photo: File | string;
  crop: Crop | null;
  onCropChange: (crop: Crop) => void;
  /** The photo is being uploaded or already was, with this crop, so it can't change. */
  locked: boolean;
  /** What to say while it's locked. */
  lockedNote?: string;
  /** The card's title; "Square Thumbnail" unless set. */
  title?: string;
  /**
   * A version of the photo to show instead, the same shape, such as one with its faces pixelated.
   * The crop is still measured on `photo`, in its pixels.
   */
  shown?: string;
}

/**
 * Picks the square of photo its thumbnail is cut from, starting from the middle, with a preview of
 * the thumbnail as the upload will make it.
 */
export function ThumbnailCrop({
  photo,
  title = "Square Thumbnail",
  shown,
  ...editor
}: ThumbnailCropProps) {
  const [objectUrl, setFile] = useObjectUrl();
  useEffect(() => setFile(typeof photo === "string" ? null : photo), [photo, setFile]);
  const url = typeof photo === "string" ? photo : objectUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Drag the square to pick the part of the photo used where every photo is a square tile,
          like the portfolio's Grid, and drag a corner to resize it. Uploading turns it into a{" "}
          {THUMBNAIL.maxEdge} × {THUMBNAIL.maxEdge} px WEBP, whatever its size here.
        </CardDescription>
      </CardHeader>
      <CardContent>{url && <CropEditor src={url} shown={shown ?? url} {...editor} />}</CardContent>
    </Card>
  );
}

type CropEditorProps = Omit<ThumbnailCropProps, "photo" | "shown"> & {
  /** The photo the crop is measured on. */
  src: string;
  /** What's drawn: src, or a version of it the same shape. */
  shown: string;
};

/** The size of the photo at src, turned upright from its EXIF orientation, once it's loaded. */
function usePhotoSize(src: string): Size | null {
  const [size, setSize] = useState<{ src: string; size: Size } | null>(null);
  useEffect(() => {
    let current = true;
    const image = new Image();
    image.addEventListener("load", () => {
      // Browsers report the size of a photo turned upright from its EXIF orientation.
      if (current)
        setSize({ src, size: { width: image.naturalWidth, height: image.naturalHeight } });
    });
    image.src = src;
    return () => {
      current = false;
    };
  }, [src]);
  return size?.src === src ? size.size : null;
}

/** The photo with the crop over it, then the thumbnail it makes. */
function CropEditor({ src, shown, crop, onCropChange, locked, lockedNote }: CropEditorProps) {
  const photo = usePhotoSize(src);
  // The crop starts in the middle once the photo's size is known.
  useEffect(() => {
    if (photo && !crop) onCropChange(centerCrop(photo));
  }, [photo, crop, onCropChange]);
  const placed = placement(photo, crop);
  const [overlays, toggleOverlay] = useOverlays();

  return (
    <div className="flex flex-col gap-4">
      <CropFrame src={shown}>
        {placed && (
          <CropBox
            placed={placed}
            locked={locked}
            overlays={overlays}
            onCropChange={onCropChange}
          />
        )}
      </CropFrame>
      {placed && <OverlayToggles overlays={overlays} onToggle={toggleOverlay} />}
      <CropSummary
        src={shown}
        placed={placed}
        overlays={overlays}
        locked={locked}
        lockedNote={lockedNote}
        onCropChange={onCropChange}
      />
    </div>
  );
}
