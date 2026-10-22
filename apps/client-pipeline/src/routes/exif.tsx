import { useForm } from "@tanstack/react-form";
import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type ExifResponse, exifMutation, type SanitizedExif } from "@/api/exif";
import { NO_GROUPS, type PhotoGroups } from "@/api/organize";
import type { PhotoIdentity } from "@/api/photos";
import { ChangePhotoButton, SavedPhotoCard } from "@/components/choose-photo-dialog";
import { ColorData, RawColorData } from "@/components/color-data";
import { EditInFlightPhoto } from "@/components/edit-in-flight";
import { PhotoGroupsCard } from "@/components/group-picker";
import { JsonCodeBlock } from "@/components/json-code-block";
import { QueuePhotoButton, useQueuedPhoto } from "@/components/bulk-upload/queue-photo-button";
import { Page } from "@/components/page";
import { AllPhotosGate } from "@/components/allphotos-check";
import {
  fileStem,
  type ExifPlace,
  NO_DETAILS,
  type PhotoDetails,
  PhotoDetailsCard,
  withDetails,
} from "@/components/photo-details";
import { FloatingAction } from "@/components/floating-actions";
import { PhotoSaveButton } from "@/components/photo-save-button";
import { R2Button } from "@/components/r2-upload/r2-button";
import { type R2Upload, useR2Upload } from "@/components/r2-upload/use-r2-upload";
import { ThumbnailCrop } from "@/components/thumbnail-crop";
import { VersionPreviews } from "@/components/version-previews";
import type { Crop } from "@/lib/crop";
import { withImages } from "@/lib/photo-images";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useObjectUrl } from "@/hooks/use-object-url";
import type { AnalyzedPhoto } from "@/stores/bulk-upload";
import { usePendingPhotoStore } from "@/stores/pending-photo";

interface PhotoSearch {
  /**
   * The path of a photo JSON file to edit, instead of adding a photo: one in the photo data pull
   * request, or one already in the portfolio.
   */
  edit?: string;
  /** The page the edit was opened from, which the back link returns to; Photos in Flight unless set. */
  from?: "gallery";
}

export const Route = createFileRoute("/exif")({
  component: PhotoRoute,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): PhotoSearch => {
    if (typeof search.edit !== "string" || !search.edit) return {};
    return search.from === "gallery"
      ? { edit: search.edit, from: "gallery" }
      : { edit: search.edit };
  },
});

function PhotoRoute() {
  const { edit, from } = Route.useSearch();
  if (!edit) return <PhotoPage />;
  return (
    <Page
      title="Edit Photo"
      description="Change a photo saved to the open “Add photo data” pull request or already in the portfolio, such as the square its Square Thumbnail is cut from. Changes go into the pull request."
      wide
      action={<ChangePhotoButton />}
    >
      <EditInFlightPhoto path={edit} from={from} />
    </Page>
  );
}

type ExifMutation = UseMutationResult<ExifResponse, Error, File>;

const JPEG_TYPES = ["image/jpeg", "image/pjpeg"];

function validatePhoto(photo: File | null): string | undefined {
  if (!photo) return "Choose a JPEG photo.";
  if (!JPEG_TYPES.includes(photo.type)) return "Only JPEG photos are supported.";
  return undefined;
}

/** State that belongs to the photo analyzed at `submittedAt`, so choosing another photo starts it over. */
function usePhotoState<T>(submittedAt: number, initial: T): [T, (value: T) => void] {
  const [state, setState] = useState<{ submittedAt: number; value: T } | null>(null);
  const value = state?.submittedAt === submittedAt ? state.value : initial;
  return [value, (next) => setState({ submittedAt, value: next })];
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
  const images = withImages(extract.data?.sanitized, r2.uploaded);
  const sanitized = images && withDetails(images, details);
  const identity = photoIdentity(extract, sanitized);

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
            saved={saved}
          />
        </div>
      </div>
    </Page>
  );
}

/** Once a photo is chosen, a button by the title to choose another; until then, the cards offer it. */
function TitleAction({ chosen }: { chosen: boolean }) {
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
function NewPhotoActions({
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
function UploadSteps({ photo, r2, crop, onCropChange, saved }: UploadStepsProps) {
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

/** What ALLPHOTOS.json is checked for, once the photo's EXIF has been read. */
function photoIdentity(extract: ExifMutation, sanitized: SanitizedExif | null) {
  if (!extract.isSuccess || !sanitized) return null;
  const { gpsPosition, createDate } = sanitized;
  return { file: extract.data.file, gpsPosition, createDate };
}

/** Picks the photo, and analyzes it as soon as a valid one is chosen. */
function PhotoCard({ extract, onReset }: { extract: ExifMutation; onReset: () => void }) {
  const form = useForm({
    defaultValues: { photo: null as File | null },
    validators: { onSubmit: ({ value }) => validatePhoto(value.photo) },
    onSubmit: async ({ value }) => {
      onReset();
      if (value.photo) await extract.mutateAsync(value.photo).catch(() => {});
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photo</CardTitle>
        <CardDescription>Choosing a photo analyzes it right away.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="photo" validators={{ onChange: ({ value }) => validatePhoto(value) }}>
            {(field) => (
              <PhotoField
                name={field.name}
                error={field.state.meta.errors[0]}
                pending={extract.isPending}
                onBlur={field.handleBlur}
                onChange={(photo) => {
                  extract.reset();
                  onReset();
                  field.handleChange(photo);
                  if (!validatePhoto(photo)) void form.handleSubmit();
                }}
              />
            )}
          </form.Field>
        </form>
      </CardContent>
    </Card>
  );
}

interface ResultsColumnProps {
  extract: ExifMutation;
  sanitized: SanitizedExif | null;
  identity: PhotoIdentity | null;
  details: PhotoDetails;
  onDetailsChange: (details: PhotoDetails) => void;
  groups: PhotoGroups;
  onGroupsChange: (groups: PhotoGroups) => void;
  /** The JSON has been saved to GitHub. */
  saved: boolean;
}

/** The analyzed photo's title, place name, comment, albums and tags unless it's already in ALLPHOTOS.json, then its results. */
function ResultsColumn({
  extract,
  sanitized,
  identity,
  details,
  onDetailsChange,
  groups,
  onGroupsChange,
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
        exifPlace={{
          city: sanitized.city,
          country: sanitized.country,
          gpsPosition: sanitized.gpsPosition,
        }}
        details={details}
        onDetailsChange={onDetailsChange}
        saved={saved}
      />
      <AllPhotosGate photo={identity} showStatus={false}>
        <NewPhotoGroups groups={groups} onGroupsChange={onGroupsChange} saved={saved} />
      </AllPhotosGate>
      {result}
    </>
  );
}

/** The new photo's albums and tags, saved in its JSON with Save. */
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

interface PhotoFieldProps {
  name: string;
  error: string | undefined;
  /** The chosen photo is being analyzed, so it can't be swapped yet. */
  pending: boolean;
  onChange: (photo: File | null) => void;
  onBlur: () => void;
}

/** A file picker until a valid photo is chosen, then the photo itself, which opens the picker again when clicked. */
function PhotoField({ name, error, pending, onChange, onBlur }: PhotoFieldProps) {
  const [previewUrl, setPreviewFile] = useObjectUrl();
  const input = useRef<HTMLInputElement>(null);
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const chosen = previewUrl !== null && !error;
  usePendingPhoto((photo) => {
    setPreviewFile(photo);
    onChange(photo);
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Once a photo is chosen, clicking it opens this hidden picker. */}
      <div className={chosen ? "hidden" : "flex flex-col gap-2"}>
        <label htmlFor={name} className="text-sm font-medium">
          JPEG photo
        </label>
        <Input
          ref={input}
          id={name}
          name={name}
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          disabled={pending}
          aria-invalid={Boolean(error)}
          aria-describedby={`${hintId} ${errorId}`}
          onBlur={onBlur}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setPreviewFile(file);
            onChange(file);
          }}
        />
      </div>
      {chosen && (
        <PhotoPreview src={previewUrl} disabled={pending} onClick={() => input.current?.click()} />
      )}
      <PhotoHint id={hintId} chosen={chosen} />
      <p id={errorId} className="text-destructive text-sm empty:hidden">
        {error}
      </p>
    </div>
  );
}

/** Picks up a photo chosen with the sidebar's Upload button, as if it had been chosen here. */
function usePendingPhoto(onPhoto: (photo: File) => void) {
  const pending = usePendingPhotoStore((state) => state.photo);
  const take = usePendingPhotoStore((state) => state.take);
  const latest = useRef(onPhoto);
  useEffect(() => {
    latest.current = onPhoto;
  });
  useEffect(() => {
    if (!pending) return;
    // After this render's other effects, so StrictMode's trial unmount can't revoke its preview.
    const timer = setTimeout(() => {
      const photo = take();
      if (photo) latest.current(photo);
    });
    return () => clearTimeout(timer);
  }, [pending, take]);
}

function PhotoHint({ id, chosen }: { id: string; chosen: boolean }) {
  return (
    <p id={id} className="text-muted-foreground text-sm">
      {chosen ? (
        "Click the photo to choose a different one."
      ) : (
        <>
          JPEG only (.jpg or .jpeg). Its resized versions are converted to WEBP when it's uploaded.
          For many photos at once, use{" "}
          <Link to="/bulk-upload" className="text-foreground underline underline-offset-4">
            Bulk Upload
          </Link>
          .
        </>
      )}
    </p>
  );
}

interface PhotoPreviewProps {
  src: string;
  disabled: boolean;
  onClick: () => void;
}

/** The chosen photo as a button that fades and shows a swap icon on hover. */
function PhotoPreview({ src, disabled, onClick }: PhotoPreviewProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Choose a different photo"
      className="group focus-visible:ring-ring/50 relative cursor-pointer overflow-hidden rounded-lg border outline-none focus-visible:ring-[3px] disabled:cursor-wait"
    >
      <img
        src={src}
        alt="The chosen photo"
        className="max-h-80 w-full object-contain transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80 group-disabled:opacity-100"
      />
      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:opacity-0">
        <span className="bg-background/80 text-foreground rounded-full p-3 shadow-sm">
          <RefreshCwIcon className="size-6" aria-hidden />
        </span>
      </span>
    </button>
  );
}

interface ExifResultProps {
  mutation: ExifMutation;
  /** The sanitized EXIF to show, which includes the R2 URL after an upload. */
  sanitized: SanitizedExif | null;
  /** The albums and tags to save the photo in. */
  groups: PhotoGroups;
}

function ExifResult({ mutation, sanitized, groups }: ExifResultProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>{mutation.variables?.name}</CardDescription>
      </CardHeader>
      <CardContent>
        <ExifResultBody mutation={mutation} sanitized={sanitized} groups={groups} />
      </CardContent>
    </Card>
  );
}

function ExifResultBody({ mutation, sanitized, groups }: ExifResultProps) {
  if (mutation.isPending) return <Spinner className="size-6" />;
  if (mutation.isError) return <p className="text-destructive">{mutation.error.message}</p>;
  if (!mutation.data) return null;
  const { file, exif, colors } = mutation.data;
  return (
    <Tabs defaultValue="sanitized">
      <TabsList>
        <TabsTrigger value="sanitized">JSON to Upload</TabsTrigger>
        <TabsTrigger value="exif">EXIF</TabsTrigger>
        <TabsTrigger value="colors">Colors</TabsTrigger>
        <TabsTrigger value="raw">Raw color data</TabsTrigger>
      </TabsList>
      <TabsContent value="sanitized">
        <UploadJson file={file} sanitized={sanitized} groups={groups} />
      </TabsContent>
      <TabsContent value="exif">
        <ExifData exif={exif} />
      </TabsContent>
      <TabsContent value="colors">
        <ColorData colors={colors} />
      </TabsContent>
      <TabsContent value="raw">
        <RawColorData raw={colors.raw} samples={colors.samples} />
      </TabsContent>
    </Tabs>
  );
}

/** The JSON Save writes: the photo's file name and its sanitized EXIF, with the images' URLs and key after an upload, then its albums and tags. */
function UploadJson({
  file,
  sanitized,
  groups,
}: {
  file: string;
  sanitized: SanitizedExif | null;
  groups: PhotoGroups;
}) {
  if (!sanitized) return <ExifData exif={null} />;
  // The title and comment first, and the albums and tags last, as Save writes them.
  const { title, comment, ...rest } = sanitized;
  return (
    <JsonCodeBlock
      value={{ title, comment, file, ...rest, albums: groups.albums, tags: groups.tags }}
      title="JSON to Upload"
    />
  );
}

function ExifData({ exif }: { exif: ExifResponse["exif"] | ExifResponse["sanitized"] }) {
  if (!exif) {
    return (
      <p className="text-muted-foreground text-sm">
        EXIF data is unavailable because exiftool is not running on the backend.
      </p>
    );
  }
  return <JsonCodeBlock value={exif} />;
}
