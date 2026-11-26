import { RotateCcwIcon } from "lucide-react";
import { THUMBNAIL } from "@/api/versions";
import { type Placed } from "@/components/thumbnail-crop/crop-box";
import { type Overlay, CropOverlays } from "@/components/thumbnail-crop/crop-overlays";
import { Button } from "@/components/ui/button";
import { type Crop, centerCrop, cropText, sameCrop } from "@/lib/crop";

interface CropSummaryProps {
  src: string;
  placed: Placed | null;
  overlays: Overlay[];
  locked: boolean;
  lockedNote?: string;
  onCropChange: (crop: Crop) => void;
}

/** The thumbnail as the upload will make it, where it's cut from, and how to change it. */
export function CropSummary({
  src,
  placed,
  overlays,
  locked,
  lockedNote,
  onCropChange,
}: CropSummaryProps) {
  if (!placed) return null;
  const { crop } = placed;
  return (
    <div className="flex flex-wrap items-start gap-4">
      <ThumbnailPreview src={src} placed={placed} overlays={overlays} />
      <div className="flex min-w-48 flex-1 flex-col gap-2 text-sm">
        <p>
          <span className="font-medium">
            {THUMBNAIL.maxEdge} × {THUMBNAIL.maxEdge} px
          </span>{" "}
          <span className="text-muted-foreground">from {cropText(crop)}.</span>
        </p>
        {crop.size < THUMBNAIL.maxEdge && (
          <p className="text-muted-foreground">
            The square is smaller than {THUMBNAIL.maxEdge} px, so it's scaled up and may look soft.
          </p>
        )}
        <CropControls
          placed={placed}
          locked={locked}
          lockedNote={lockedNote}
          onCropChange={onCropChange}
        />
      </div>
    </div>
  );
}

interface CropControlsProps {
  placed: Placed;
  locked: boolean;
  lockedNote?: string;
  onCropChange: (crop: Crop) => void;
}

/** How to change the crop, and a way back to the middle, or that it can't change anymore. */
function CropControls({
  placed,
  locked,
  lockedNote = "The Square Thumbnail is uploaded with this square. Choose the photo again to pick another.",
  onCropChange,
}: CropControlsProps) {
  if (locked) return <p className="text-muted-foreground">{lockedNote}</p>;
  const middle = centerCrop(placed.photo);
  return (
    <>
      <p className="text-muted-foreground">
        Arrow keys move the focused square (Shift for bigger steps), and + and − resize it.
      </p>
      {!sameCrop(placed.crop, middle) && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onCropChange(middle)}
        >
          <RotateCcwIcon />
          Back to the middle
        </Button>
      )}
    </>
  );
}

/** The crop scaled into a square, as the thumbnail will show it. */
interface ThumbnailPreviewProps {
  src: string;
  placed: Placed;
  overlays: Overlay[];
}

function ThumbnailPreview({ src, placed: { photo, crop }, overlays }: ThumbnailPreviewProps) {
  return (
    <figure className="flex flex-col gap-1.5">
      {/* A square, so percentages of its width and height scale the photo the same way. */}
      <div className="bg-muted relative size-40 overflow-hidden rounded-md border">
        <img
          src={src}
          alt="Preview of the Square Thumbnail"
          draggable={false}
          className="absolute max-w-none"
          style={{
            left: `${(-crop.x / crop.size) * 100}%`,
            top: `${(-crop.y / crop.size) * 100}%`,
            width: `${(photo.width / crop.size) * 100}%`,
            height: `${(photo.height / crop.size) * 100}%`,
          }}
        />
        <CropOverlays overlays={overlays} />
      </div>
      <figcaption className="text-muted-foreground text-xs">Square Thumbnail preview</figcaption>
    </figure>
  );
}
