import { useForm } from "@tanstack/react-form";
import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ExifResponse, exifMutation, type SanitizedExif } from "@/api/exif";
import { type UploadResponse, uploadMutation } from "@/api/upload";
import { ColorData, RawColorData } from "@/components/color-data";
import { GitHubSaveCard } from "@/components/github-save";
import { JsonCodeBlock } from "@/components/json-code-block";
import { Page } from "@/components/page";
import { R2Upload } from "@/components/r2-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useObjectUrl } from "@/hooks/use-object-url";

export const Route = createFileRoute("/exif")({
  component: ExifPage,
});

type ExifMutation = UseMutationResult<ExifResponse, Error, File>;
type UploadMutation = UseMutationResult<UploadResponse, Error, File>;

const JPEG_TYPES = ["image/jpeg", "image/pjpeg"];

function validatePhoto(photo: File | null): string | undefined {
  if (!photo) return "Choose a JPEG photo.";
  if (!JPEG_TYPES.includes(photo.type)) return "Only JPEG photos are supported.";
  return undefined;
}

/** The sanitized EXIF with the photo's R2 URL filled in once it has been uploaded. */
function withImages(sanitized: SanitizedExif | null, upload: UploadResponse | undefined) {
  if (!sanitized || !upload) return sanitized;
  return { ...sanitized, images: { ...sanitized.images, full: upload.url } };
}

function ExifPage() {
  const extract = useMutation(exifMutation);
  // Lives here rather than in the upload card so its URL can go into the sanitized EXIF.
  const upload = useMutation(uploadMutation);

  const form = useForm({
    defaultValues: { photo: null as File | null },
    validators: { onSubmit: ({ value }) => validatePhoto(value.photo) },
    onSubmit: async ({ value }) => {
      upload.reset();
      if (value.photo) await extract.mutateAsync(value.photo).catch(() => {});
    },
  });

  return (
    <Page
      title="EXIF and color data"
      description="Upload a JPEG to read its metadata with exiftool and its colors with go-colorful on the Go backend."
    >
      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
          <CardDescription>Pick a photo, check the preview, then confirm.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
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
                  disabled={extract.isPending}
                  onBlur={field.handleBlur}
                  onChange={(photo) => {
                    extract.reset();
                    upload.reset();
                    field.handleChange(photo);
                  }}
                />
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.canSubmit && state.values.photo !== null}>
              {(canSubmit) => <SubmitButton disabled={!canSubmit} pending={extract.isPending} />}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>

      {!extract.isIdle && (
        <ExifResult
          mutation={extract}
          sanitized={withImages(extract.data?.sanitized ?? null, upload.data)}
        />
      )}
      {extract.isSuccess && (
        <PhotoActions
          key={extract.submittedAt}
          photo={extract.variables}
          file={extract.data.file}
          sanitized={withImages(extract.data.sanitized, upload.data)}
          upload={upload}
        />
      )}
    </Page>
  );
}

/** What can be done with an analyzed photo: upload it to R2, and save its sanitized EXIF to GitHub. */
function PhotoActions({ photo, file, sanitized, upload }: PhotoActionsProps) {
  return (
    <>
      <R2Upload photo={photo} upload={upload} />
      {sanitized && <GitHubSaveCard file={file} sanitized={sanitized} />}
    </>
  );
}

interface PhotoActionsProps {
  photo: File;
  file: string;
  sanitized: SanitizedExif | null;
  upload: UploadMutation;
}

interface PhotoFieldProps {
  name: string;
  error: string | undefined;
  disabled: boolean;
  onChange: (photo: File | null) => void;
  onBlur: () => void;
}

function PhotoField({ name, error, disabled, onChange, onBlur }: PhotoFieldProps) {
  const [previewUrl, setPreviewFile] = useObjectUrl();
  const errorId = `${name}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="text-sm font-medium">
        JPEG photo
      </label>
      <Input
        id={name}
        name={name}
        type="file"
        accept="image/jpeg"
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        onBlur={onBlur}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setPreviewFile(file);
          onChange(file);
        }}
      />
      <p id={errorId} className="text-destructive text-sm empty:hidden">
        {error}
      </p>
      {previewUrl && !error && <PhotoPreview src={previewUrl} />}
    </div>
  );
}

function PhotoPreview({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt="Preview of the selected photo"
      className="max-h-80 w-full rounded-lg border object-contain"
    />
  );
}

function SubmitButton({ disabled, pending }: { disabled: boolean; pending: boolean }) {
  return (
    <Button type="submit" className="self-start" disabled={disabled || pending}>
      {pending && <Spinner />}
      {pending ? "Analyzing photo…" : "Use this photo"}
    </Button>
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
  const { exif, colors } = mutation.data;
  return (
    <Tabs defaultValue="sanitized">
      <TabsList>
        <TabsTrigger value="sanitized">Sanitized EXIF</TabsTrigger>
        <TabsTrigger value="exif">EXIF</TabsTrigger>
        <TabsTrigger value="colors">Colors</TabsTrigger>
        <TabsTrigger value="raw">Raw color data</TabsTrigger>
      </TabsList>
      <TabsContent value="sanitized">
        <ExifData exif={sanitized} />
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
