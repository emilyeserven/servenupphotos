import type { SanitizedExif } from "@/api/exif";
import type { CustomLens } from "@/api/lenses";
import type { PhotoGroups } from "@/api/organize";
import type { PhotoIdentity } from "@/api/photos";
import { ExifResult } from "@/components/add-photo/exif-result";
import type { ExifMutation } from "@/components/add-photo/photo-state";
import { AllPhotosGate } from "@/components/allphotos-check";
import { SavedPhotoCard } from "@/components/choose-photo-dialog";
import { NewPhotoLens } from "@/components/custom-lens-card";
import { PhotoGroupsCard } from "@/components/photo-groups-card";
import {
  fileStem,
  type ExifPlace,
  type PhotoDetails,
  PhotoDetailsCard,
} from "@/components/photo-details";
import type { LensChoice } from "@/lib/custom-lens";
import type { CombinedPhoto } from "@/lib/group-photos";

interface ResultsColumnProps {
  extract: ExifMutation;
  sanitized: SanitizedExif | null;
  identity: PhotoIdentity | null;
  details: PhotoDetails;
  onDetailsChange: (details: PhotoDetails) => void;
  groups: PhotoGroups;
  onGroupsChange: (groups: PhotoGroups) => void;
  /** The custom lenses to pick from. */
  lenses: CustomLens[];
  onLensChange: (lens: LensChoice) => void;
  /** The JSON has been saved to GitHub. */
  saved: boolean;
}

/** Where the uploaded photo's EXIF says it was taken, for the Location card. */
function exifPlaceOf(sanitized: SanitizedExif): ExifPlace {
  return {
    city: sanitized.city,
    state: sanitized.state ?? null,
    country: sanitized.country,
    gpsPosition: sanitized.gpsPosition,
    createDate: sanitized.createDate,
  };
}

/** The analyzed photo's title, place name, comment, albums, tags and lens unless it's already in ALLPHOTOS.json, then its results. */
export function ResultsColumn({
  extract,
  sanitized,
  identity,
  details,
  onDetailsChange,
  groups,
  onGroupsChange,
  lenses,
  onLensChange,
  saved,
}: ResultsColumnProps) {
  if (extract.isIdle) return <SavedPhotoCard />;
  const result = <ExifResult mutation={extract} sanitized={sanitized} groups={groups} />;
  if (!extract.isSuccess || !sanitized) return result;
  return (
    <>
      <NewPhotoDetails
        key={`details-${extract.submittedAt}`}
        identity={identity}
        file={extract.data.file}
        exifPlace={exifPlaceOf(sanitized)}
        details={details}
        onDetailsChange={onDetailsChange}
        saved={saved}
      />
      <AllPhotosGate photo={identity} showStatus={false}>
        <NewPhotoGroups groups={groups} onGroupsChange={onGroupsChange} saved={saved} />
        <NewPhotoLens
          photo={sanitized as unknown as CombinedPhoto}
          lenses={lenses}
          onChange={onLensChange}
          saved={saved}
        />
      </AllPhotosGate>
      {result}
    </>
  );
}

/** The new photo's albums, tags and genres, saved in its JSON with Save. */
function NewPhotoGroups({
  groups,
  onGroupsChange,
  saved,
}: Pick<ResultsColumnProps, "groups" | "onGroupsChange" | "saved">) {
  return (
    <PhotoGroupsCard
      value={groups}
      onChange={onGroupsChange}
      description={
        saved ? "Saved with the photo's JSON." : "Optional, and saved in the JSON when you save."
      }
      disabled={saved}
    />
  );
}

interface NewPhotoDetailsProps {
  identity: PhotoIdentity | null;
  file: string;
  /** The city and country read from the photo's EXIF. */
  exifPlace: ExifPlace;
  details: PhotoDetails;
  onDetailsChange: (details: PhotoDetails) => void;
  saved: boolean;
}

/** The new photo's title, place name, custom city and country, and comment, unless it's already in ALLPHOTOS.json. */
function NewPhotoDetails({
  identity,
  file,
  exifPlace,
  details,
  onDetailsChange,
  saved,
}: NewPhotoDetailsProps) {
  return (
    <AllPhotosGate photo={identity} showStatus={false}>
      <PhotoDetailsCard
        value={details}
        onChange={onDetailsChange}
        fallbackTitle={fileStem(file)}
        exifPlace={exifPlace}
        description={
          saved
            ? "Saved with the photo's JSON."
            : "All optional, and saved in the JSON when you save."
        }
        disabled={saved}
      />
    </AllPhotosGate>
  );
}
