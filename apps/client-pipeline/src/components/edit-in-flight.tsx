import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import {
  type InFlightFileRead,
  type InFlightRead,
  photosInFlightQuery,
  publishedPhotosQuery,
} from "@/api/photos";
import { savedThumbnailCrop, thumbnailCropQuery } from "@/api/versions";
import { PhotoGroupsCard } from "@/components/group-picker";
import { JsonCodeBlock } from "@/components/json-code-block";
import { fileStem, PhotoDetailsCard, savedExifPlace } from "@/components/photo-details";
import { QueryResult } from "@/components/query-result";
import { SocialPostsCard } from "@/components/social-posts-card";
import { ThumbnailCrop } from "@/components/thumbnail-crop";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type Crop } from "@/lib/crop";
import {
  type Editable,
  fileName,
  findEditable,
  fromBase,
  inPullRequest,
  isPublished,
  photoFile,
} from "@/components/edit-in-flight/photo-json";
import { CameraOverridesCard } from "@/components/edit-in-flight/camera-overrides-card";
import { SaveActions, SaveStatus } from "@/components/edit-in-flight/save-actions";
import { overridesApplied } from "@/components/edit-in-flight/lens-edit";
import { type Edit, useEdit, useLensSettings, useSave } from "@/components/edit-in-flight/use-edit";
import { CustomLensCard } from "@/components/custom-lens-card";
import { lensChanged, withLensChoice } from "@/lib/custom-lens";

/**
 * The Photo page for a photo in the photo data pull request, or already in the portfolio: its
 * Square Thumbnail crop, title, place name, comment and social media posts can be changed, its
 * custom lens chosen and camera overrides applied again, then saved by remaking the thumbnail in R2
 * when the crop moved and updating its JSON in the pull request. A photo already in the portfolio is
 * read from the base branch until its first save puts it in the pull request.
 */
export function EditInFlightPhoto({ path, from }: { path: string; from?: "gallery" }) {
  const inFlight = useQuery(photosInFlightQuery);
  return (
    <>
      <BackLink from={from} />
      <QueryResult query={inFlight} pendingLabel="Reading the pull request from GitHub…">
        {(data) => <EditFound inFlight={data} path={path} />}
      </QueryResult>
    </>
  );
}

/**
 * The editor for the file at path, from the pull request when it's there, or else from the base
 * branch. Both render the editor in the same place with the same key, so it keeps what it showed
 * when a first save moves the photo into the pull request.
 */
function EditFound({ inFlight, path }: { inFlight: InFlightRead; path: string }) {
  const editable = useEditable(inFlight, path);
  if (editable === null) return <p>Reading the photo from GitHub…</p>;
  if (typeof editable === "string") return <Problem>{editable}</Problem>;
  // Keyed by the photo's image rather than its file, which a new title can rename.
  return <EditWithSavedCrop key={editable.image.key} editable={editable} />;
}

/**
 * What to edit the file at path from, or why it can't be edited: the pull request's copy when the
 * pull request has it, or else the base branch's, which is null while it's being read.
 */
function useEditable(inFlight: InFlightRead, path: string): Editable | string | null {
  const fromPullRequest = findEditable(inFlight, path);
  const onBase = typeof fromPullRequest === "string" && !inPullRequest(inFlight, path);
  const published = useQuery({ ...publishedPhotosQuery, enabled: onBase });
  return onBase ? fromBase(published, path) : fromPullRequest;
}

function BackLink({ from }: { from?: "gallery" }) {
  return (
    <Button variant="outline" size="sm" className="self-start" asChild>
      <Link to={from === "gallery" ? "/gallery" : "/in-flight"}>
        <ArrowLeftIcon />
        {from === "gallery" ? "Gallery" : "Photos in Flight"}
      </Link>
    </Button>
  );
}

function Problem({ children }: { children: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Waits for the crop saved with the Square Thumbnail, which the editor starts from, or else the one
 * saved in the photo's JSON.
 */
function EditWithSavedCrop({ editable }: { editable: Editable }) {
  const saved = useQuery(thumbnailCropQuery(editable.image.key));
  return (
    <QueryResult query={saved} pendingLabel="Reading the Square Thumbnail's crop from R2…">
      {(crop) => (
        <EditSteps
          editable={editable}
          savedCrop={crop ?? savedThumbnailCrop(editable.data.images)}
        />
      )}
    </QueryResult>
  );
}

interface EditStepsProps {
  editable: Editable;
  /** The crop saved with the Square Thumbnail in R2; null when it was cut from the middle. */
  savedCrop: Crop | null;
}

function EditSteps({ editable, savedCrop }: EditStepsProps) {
  const edit = useEdit(editable, savedCrop);
  const save = useSave(editable, edit.onSaved);
  const pending = save.mutation.isPending;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <SaveActions edit={edit} save={save} />
      <SaveStatus file={editable.file} edit={edit} save={save} />
      <div className="flex min-w-0 flex-col gap-6">
        <ThumbnailCrop
          photo={editable.image.url}
          crop={edit.crop}
          onCropChange={edit.onCropChange}
          locked={pending}
          lockedNote="Saving the Square Thumbnail with this square…"
        />
        <PhotoGroupsCard
          value={edit.groups}
          onChange={edit.setGroups}
          description="Saving changes writes them over the ones in the JSON."
          disabled={pending}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <PhotoDetailsCard
          value={edit.details}
          onChange={edit.setDetails}
          fallbackTitle={fileStem(photoFile(editable.data) || fileName(editable.file.path))}
          exifPlace={savedExifPlace(edit.savedData)}
          description="All optional. Saving changes writes them over the ones in the JSON, and a new title renames a file that's new in the pull request."
          disabled={pending}
        />
        <SocialPostsCard
          value={edit.socialPosts}
          onChange={edit.setSocialPosts}
          calendarDate={calendarDate(edit.savedData)}
          disabled={pending}
        />
        <LensCards edit={edit} disabled={pending} />
        <JsonPreview file={editable.file} edit={edit} />
      </div>
    </div>
  );
}

/** The photo's custom lens and manual aperture, then what its camera overrides and lens change. */
function LensCards({ edit, disabled }: { edit: Edit; disabled: boolean }) {
  const settings = useLensSettings();
  const { savedData, lensEdit, setLensEdit } = edit;
  return (
    <>
      <CustomLensCard
        value={lensEdit}
        onChange={(choice) => setLensEdit({ ...lensEdit, ...choice })}
        lenses={settings.lenses}
        description="Saving changes writes it, with the camera overrides, over the JSON."
        disabled={disabled}
      />
      <CameraOverridesCard
        photo={withLensChoice(savedData, lensEdit)}
        settings={settings}
        applied={overridesApplied(savedData, lensEdit)}
        forced={lensChanged(savedData, lensEdit)}
        onApply={(apply) => setLensEdit({ ...lensEdit, apply })}
        disabled={disabled}
      />
    </>
  );
}

/** The day the Instagram calendar has the photo scheduled for, when it has one. */
function calendarDate(data: Record<string, unknown>): string | null {
  const date = data.socialMediaPublishDate;
  return typeof date === "string" && date ? date : null;
}

/** The file's JSON, as saving would write it when there's something to save. */
function JsonPreview({ file, edit }: { file: InFlightFileRead; edit: Edit }) {
  const where = isPublished(file) ? "the portfolio" : "the pull request";
  return (
    <Card>
      <CardHeader>
        <CardTitle>JSON to Upload</CardTitle>
        <CardDescription>
          {edit.next
            ? "What saving writes over the file in the pull request."
            : `The file as ${where} has it.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <JsonCodeBlock value={edit.next ?? edit.savedData} title={file.path} />
      </CardContent>
    </Card>
  );
}
