import type { ExifResponse, SanitizedExif } from "@/api/exif";
import { NO_GROUPS, type PhotoGroups } from "@/api/organize";
import type { PhotoIdentity } from "@/api/photos";
import type { ExifMutation } from "@/components/add-photo/photo-state";
import { AllPhotosGate } from "@/components/allphotos-check";
import { QueuePhotoButton, useQueuedPhoto } from "@/components/bulk-upload/queue-photo-button";
import { ChangePhotoButton } from "@/components/choose-photo-dialog";
import { FloatingAction } from "@/components/floating-actions";
import { PhotoSaveButton } from "@/components/photo-save-button";
import { R2Button } from "@/components/r2-upload/r2-button";
import type { R2Upload } from "@/components/r2-upload/use-r2-upload";
import { ThumbnailCrop } from "@/components/thumbnail-crop";
import { VersionPreviews } from "@/components/version-previews";
import type { Crop } from "@/lib/crop";
import type { AnalyzedPhoto } from "@/stores/bulk-upload";

/** Once a photo is chosen, a button by the title to choose another; until then, the cards offer it. */
export function TitleAction({ chosen }: { chosen: boolean }) {
  return chosen ? <ChangePhotoButton /> : null;
}

interface NewPhotoActionsProps {
  extract: ExifMutation;
  sanitized: SanitizedExif | null;
  identity: PhotoIdentity | null;
  groups: PhotoGroups;
  crop: Crop | null;
  r2: R2Upload;
  onSaved: () => void;
}

/**
 * Upload to R2 and Save, floated next to the sync button, once the photo is analyzed, unless it's
 * already in ALLPHOTOS.json. Upload comes first, so the saved JSON links to the photo in R2.
 */
export function NewPhotoActions({
  extract,
  sanitized,
  identity,
  groups,
  crop,
  r2,
  onSaved,
}: NewPhotoActionsProps) {
  if (!extract.isSuccess || !sanitized) return null;
  return (
    // The gate under the photo shows the check's status, so this one stays quiet.
    <AllPhotosGate key={extract.submittedAt} photo={identity} showStatus={false}>
      <FloatingAction>
        <PhotoButtons
          photo={{
            file: extract.variables,
            exif: { ...extract.data, sanitized },
            crop: crop ?? undefined,
            groups,
          }}
          r2={r2}
          onSaved={onSaved}
        />
      </FloatingAction>
    </AllPhotosGate>
  );
}

interface PhotoButtonsProps {
  /** The analyzed photo with what was chosen for it, as the queue takes it. */
  photo: AnalyzedPhoto & { exif: ExifResponse & { sanitized: SanitizedExif } };
  r2: R2Upload;
  onSaved: () => void;
}

/**
 * Upload & save, which hands the photo to the upload queue, until it's uploaded here; and Upload to
 * R2 and Save, until it's handed to the queue.
 */
function PhotoButtons({ photo, r2, onSaved }: PhotoButtonsProps) {
  const queued = useQueuedPhoto(photo.file);
  return (
    <>
      {!r2Started(r2) && <QueuePhotoButton photo={photo} onQueued={onSaved} />}
      {!queued && <R2AndSave photo={photo} r2={r2} onSaved={onSaved} />}
    </>
  );
}

/** Whether the photo is being, or has been, uploaded here rather than through the queue. */
function r2Started(r2: R2Upload): boolean {
  return r2.pending || Boolean(r2.uploaded);
}

function R2AndSave({ photo, r2, onSaved }: PhotoButtonsProps) {
  return (
    <>
      <R2Button r2={r2} photo={photo.file} />
      <PhotoSaveButton
        file={photo.exif.file}
        sanitized={photo.exif.sanitized}
        groups={photo.groups ?? NO_GROUPS}
        uploaded={Boolean(r2.uploaded)}
        onSaved={onSaved}
      />
    </>
  );
}

interface UploadStepsProps {
  photo: File;
  r2: R2Upload;
  crop: Crop | null;
  onCropChange: (crop: Crop) => void;
  /** The JSON has been saved to GitHub, with the square as it is. */
  saved: boolean;
}

/** The resized versions and the square thumbnail's crop, for one analyzed photo. */
export function UploadSteps({ photo, r2, crop, onCropChange, saved }: UploadStepsProps) {
  return (
    <>
      <VersionPreviews photo={photo} />
      <ThumbnailCrop
        photo={photo}
        crop={crop}
        onCropChange={onCropChange}
        locked={r2.pending || saved}
        lockedNote={lockedNote(saved)}
      />
    </>
  );
}

/** Why the square can't move: it's saved in the JSON, or being uploaded. */
function lockedNote(saved: boolean): string {
  return saved
    ? "Saved to the batch with this square. Change it from the photo's Edit button in Photos in Flight."
    : "Uploading with this square…";
}
