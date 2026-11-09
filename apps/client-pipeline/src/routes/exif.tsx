import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { exifMutation } from "@/api/exif";
import { NO_GROUPS } from "@/api/organize";
import { NewPhotoActions, TitleAction, UploadSteps } from "@/components/add-photo/photo-actions";
import { PhotoCard } from "@/components/add-photo/photo-picker";
import { newPhotoName, photoIdentity, usePhotoState } from "@/components/add-photo/photo-state";
import { ResultsColumn } from "@/components/add-photo/results-column";
import { AllPhotosGate } from "@/components/allphotos-check";
import { ChangePhotoButton } from "@/components/choose-photo-dialog";
import { EditInFlightPhoto } from "@/components/edit-in-flight";
import { withNewLens } from "@/components/edit-in-flight/lens-edit";
import { useLensSettings } from "@/components/edit-in-flight/use-edit";
import { EditPhotoById, photoIdSearch } from "@/components/edit-photo-by-id";
import { Page } from "@/components/page";
import { NO_DETAILS, withDetails } from "@/components/photo-details";
import { useR2Upload } from "@/components/r2-upload/use-r2-upload";
import type { Crop } from "@/lib/crop";
import type { LensChoice } from "@/lib/custom-lens";
import { withImages } from "@/lib/photo-images";
import { useTabSubject } from "@/stores/tab-title";

interface PhotoSearch {
  /**
   * The path of a photo JSON file to edit, instead of adding a photo: one in the photo data pull
   * request, or one already in the portfolio.
   */
  edit?: string;
  /** The page the edit was opened from, which the back link returns to; Photos in Flight unless set. */
  from?: "gallery";
  /** The ID of a photo to edit, when the page linking here knows only that, such as Trip Lines. */
  photo?: number;
}

export const Route = createFileRoute("/exif")({
  component: PhotoRoute,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): PhotoSearch => ({
    ...editSearch(search),
    ...photoIdSearch(search),
  }),
});

/** The Photo page's `?edit=` and `?from=`, when it edits a photo file by its path. */
function editSearch(search: Record<string, unknown>): PhotoSearch {
  if (typeof search.edit !== "string" || !search.edit) return {};
  return search.from === "gallery" ? { edit: search.edit, from: "gallery" } : { edit: search.edit };
}

function PhotoRoute() {
  const { edit, from, photo } = Route.useSearch();
  if (edit) {
    return (
      <EditPage>
        <EditInFlightPhoto path={edit} from={from} />
      </EditPage>
    );
  }
  if (photo === undefined) return <PhotoPage />;
  return (
    <EditPage>
      <EditPhotoById id={photo} />
    </EditPage>
  );
}

/** The Edit Photo page around an editor. */
function EditPage({ children }: { children: React.ReactNode }) {
  return (
    <Page
      title="Edit Photo"
      description="Change a photo waiting for Commit, in the open “Add photo data” pull request, or already in the portfolio, such as the square its Square Thumbnail is cut from. Changes wait for Commit."
      wide
      action={<ChangePhotoButton />}
    >
      {children}
    </Page>
  );
}

function PhotoPage() {
  const extract = useMutation(exifMutation);
  // Starts as the middle of the photo once it has loaded; a new photo starts it over.
  const [crop, setCrop] = usePhotoState<Crop | null>(extract.submittedAt, null);
  // Lives here so the uploaded photo's URLs can go into the sanitized EXIF.
  const r2 = useR2Upload(crop);
  // Lives here so it can go into the JSON to upload and the JSON saved to GitHub.
  const [details, setDetails] = usePhotoState(extract.submittedAt, NO_DETAILS);
  const [groups, setGroups] = usePhotoState(extract.submittedAt, NO_GROUPS);
  const [saved, setSaved] = usePhotoState(extract.submittedAt, false);
  const [lens, setLens] = usePhotoState<LensChoice | null>(extract.submittedAt, null);
  const lensSettings = useLensSettings();
  const images = withImages(extract.data?.sanitized, r2.uploaded);
  const sanitized = images && withNewLens(withDetails(images, details), lens, lensSettings);
  const identity = photoIdentity(extract, sanitized);
  useTabSubject(newPhotoName(extract, details));

  return (
    <Page
      title="Photo"
      description="Choose a JPEG to read its metadata with exiftool and its colors with go-colorful on the Go backend, then upload it and save its data."
      wide
      action={<TitleAction chosen={!extract.isIdle} />}
    >
      <NewPhotoActions
        extract={extract}
        sanitized={sanitized}
        identity={identity}
        groups={groups}
        crop={crop}
        r2={r2}
        onSaved={() => setSaved(true)}
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <PhotoCard extract={extract} onReset={r2.reset} />
          {/* Keyed by submission so a new photo starts with fresh cards. */}
          {extract.isSuccess && (
            <AllPhotosGate key={extract.submittedAt} photo={identity}>
              <UploadSteps
                photo={extract.variables}
                r2={r2}
                crop={crop}
                onCropChange={setCrop}
                saved={saved}
              />
            </AllPhotosGate>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <ResultsColumn
            extract={extract}
            sanitized={sanitized}
            identity={identity}
            details={details}
            onDetailsChange={setDetails}
            groups={groups}
            onGroupsChange={setGroups}
            lenses={lensSettings.lenses}
            onLensChange={setLens}
            saved={saved}
          />
        </div>
      </div>
    </Page>
  );
}
