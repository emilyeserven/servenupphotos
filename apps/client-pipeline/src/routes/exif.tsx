import { useForm } from "@tanstack/react-form";
import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { useRef, useState } from "react";
import { type ExifResponse, exifMutation, type SanitizedExif } from "@/api/exif";
import type { PhotoIdentity } from "@/api/photos";
import { type UploadMutation, type UploadResponse, uploadMutation } from "@/api/upload";
import { ColorData, RawColorData } from "@/components/color-data";
import { GitHubSaveCard } from "@/components/github-save";
import { JsonCodeBlock } from "@/components/json-code-block";
import { Page } from "@/components/page";
import { AllPhotosGate } from "@/components/allphotos-check";
import { R2Upload } from "@/components/r2-upload";
import { ThumbnailCrop } from "@/components/thumbnail-crop";
import { VersionPreviews } from "@/components/version-previews";
import type { Crop } from "@/lib/crop";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useObjectUrl } from "@/hooks/use-object-url";

export const Route = createFileRoute("/exif")({
  component: PhotoPage,
  staticData: { wide: true },
});

type ExifMutation = UseMutationResult<ExifResponse, Error, File>;

const JPEG_TYPES = ["image/jpeg", "image/pjpeg"];

function validatePhoto(photo: File | null): string | undefined {
  if (!photo) return "Choose a JPEG photo.";
  if (!JPEG_TYPES.includes(photo.type)) return "Only JPEG photos are supported.";
  return undefined;
}

/** The sanitized EXIF with the photo's R2 URLs and key filled in once it has been uploaded. */
function withImages(
  sanitized: SanitizedExif | null | undefined,
  upload: UploadResponse | undefined,
): SanitizedExif | null {
  if (!sanitized || !upload) return sanitized ?? null;
  return {
    ...sanitized,
    images: {
      ...sanitized.images,
      full: upload.url,
      key: upload.key,
      xlarge: upload.versions.xlarge.url,
      large: upload.versions.large.url,
      medium: upload.versions.medium.url,
      small: upload.versions.small.url,
      xsmall: upload.versions.xsmall.url,
      preview: upload.versions.preview.url,
      thumbnail: upload.versions.thumbnail.url,
    },
  };
}

function PhotoPage() {
  const extract = useMutation(exifMutation);
  // Lives here rather than in the upload card so its URL can go into the sanitized EXIF.
  const upload = useMutation(uploadMutation);
  const sanitized = withImages(extract.data?.sanitized, upload.data);
  const identity = photoIdentity(extract, sanitized);

  return (
    <Page
      title="Photo"
      description="Choose a JPEG to read its metadata with exiftool and its colors with go-colorful on the Go backend, then upload it and save its data."
      wide
    >
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <PhotoCard extract={extract} upload={upload} />
          {/* Keyed by submission so a new photo starts with fresh cards. */}
          {extract.isSuccess && (
            <AllPhotosGate key={extract.submittedAt} photo={identity}>
              <UploadSteps photo={extract.variables} upload={upload} />
            </AllPhotosGate>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <ResultsColumn extract={extract} sanitized={sanitized} identity={identity} />
        </div>
      </div>
    </Page>
  );
}

/** The resized versions, the square thumbnail's crop and the upload, for one analyzed photo. */
function UploadSteps({ photo, upload }: { photo: File; upload: UploadMutation }) {
  // Starts as the middle of the photo once it has loaded; a new photo remounts this, starting over.
  const [crop, setCrop] = useState<Crop | null>(null);
  return (
    <>
      <VersionPreviews photo={photo} />
      <ThumbnailCrop
        photo={photo}
        crop={crop}
        onCropChange={setCrop}
        locked={upload.isPending || upload.isSuccess}
      />
      <R2Upload photo={photo} upload={upload} crop={crop} />
    </>
  );
}

/** What ALLPHOTOS.json is checked for, once the photo's EXIF has been read. */
function photoIdentity(extract: ExifMutation, sanitized: SanitizedExif | null) {
  if (!extract.isSuccess || !sanitized) return null;
  const { gpsPosition, createDate } = sanitized;
  return { file: extract.data.file, gpsPosition, createDate };
}

/** Picks the photo, and analyzes it as soon as a valid one is chosen. */
function PhotoCard({ extract, upload }: { extract: ExifMutation; upload: UploadMutation }) {
  const form = useForm({
    defaultValues: { photo: null as File | null },
    validators: { onSubmit: ({ value }) => validatePhoto(value.photo) },
    onSubmit: async ({ value }) => {
      upload.reset();
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
                  upload.reset();
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
}

/** The analyzed photo's results, then saving them to GitHub unless it's already in ALLPHOTOS.json. */
function ResultsColumn({ extract, sanitized, identity }: ResultsColumnProps) {
  if (extract.isIdle) return null;
  return (
    <>
      <ExifResult mutation={extract} sanitized={sanitized} />
      {extract.isSuccess && sanitized && (
        // The gate in the other column shows the check's status, so this one stays quiet.
        <AllPhotosGate key={extract.submittedAt} photo={identity} showStatus={false}>
          <GitHubSaveCard file={extract.data.file} sanitized={sanitized} />
        </AllPhotosGate>
      )}
    </>
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

function PhotoHint({ id, chosen }: { id: string; chosen: boolean }) {
  return (
    <p id={id} className="text-muted-foreground text-sm">
      {chosen
        ? "Click the photo to choose a different one."
        : "JPEG only (.jpg or .jpeg). Its resized versions are converted to WEBP when it's uploaded."}
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
}

function ExifResult({ mutation, sanitized }: ExifResultProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>{mutation.variables?.name}</CardDescription>
      </CardHeader>
      <CardContent>
        <ExifResultBody mutation={mutation} sanitized={sanitized} />
      </CardContent>
    </Card>
  );
}

function ExifResultBody({ mutation, sanitized }: ExifResultProps) {
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
        <UploadJson file={file} sanitized={sanitized} />
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

/** The JSON Save to GitHub writes: the photo's file name and its sanitized EXIF, with the images' URLs and key after an upload. */
function UploadJson({ file, sanitized }: { file: string; sanitized: SanitizedExif | null }) {
  if (!sanitized) return <ExifData exif={null} />;
  return <JsonCodeBlock value={{ file, ...sanitized }} title="JSON to Upload" />;
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
