import { useForm } from "@tanstack/react-form";
import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ExifResponse, exifMutation } from "@/api/exif";
import { ColorData, RawColorData } from "@/components/color-data";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useObjectUrl } from "@/hooks/use-object-url";

export const Route = createFileRoute("/exif")({
  component: ExifPage,
});

type ExifMutation = UseMutationResult<ExifResponse, Error, File>;

const JPEG_TYPES = ["image/jpeg", "image/pjpeg"];

function validatePhoto(photo: File | null): string | undefined {
  if (!photo) return "Choose a JPEG photo.";
  if (!JPEG_TYPES.includes(photo.type)) return "Only JPEG photos are supported.";
  return undefined;
}

function ExifPage() {
  const extract = useMutation(exifMutation);

  const form = useForm({
    defaultValues: { photo: null as File | null },
    validators: { onSubmit: ({ value }) => validatePhoto(value.photo) },
    onSubmit: async ({ value }) => {
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

      {!extract.isIdle && <ExifResult mutation={extract} />}
    </Page>
  );
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

function ExifResult({ mutation }: { mutation: ExifMutation }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>{mutation.variables?.name}</CardDescription>
      </CardHeader>
      <CardContent>
        <ExifResultBody mutation={mutation} />
      </CardContent>
    </Card>
  );
}

function ExifResultBody({ mutation }: { mutation: ExifMutation }) {
  if (mutation.isPending) return <Spinner className="size-6" />;
  if (mutation.isError) return <p className="text-destructive">{mutation.error.message}</p>;
  if (!mutation.data) return null;
  const { exif, sanitized, colors } = mutation.data;
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
  return <CodeBlock language="json" code={JSON.stringify(exif, null, 2)} />;
}
