import { useForm } from "@tanstack/react-form";
import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ColorAnalysis, type ExifResponse, exifMutation } from "@/api/exif";
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
  const { exif, colors } = mutation.data;
  return (
    <Tabs defaultValue="exif">
      <TabsList>
        <TabsTrigger value="exif">EXIF</TabsTrigger>
        <TabsTrigger value="colors">Colors</TabsTrigger>
      </TabsList>
      <TabsContent value="exif">
        <ExifData exif={exif} />
      </TabsContent>
      <TabsContent value="colors">
        <ColorData colors={colors} />
      </TabsContent>
    </Tabs>
  );
}

function ExifData({ exif }: { exif: ExifResponse["exif"] }) {
  if (!exif) {
    return (
      <p className="text-muted-foreground text-sm">
        EXIF data is unavailable because exiftool is not running on the backend.
      </p>
    );
  }
  return <CodeBlock language="json" code={JSON.stringify(exif, null, 2)} />;
}

function ColorData({ colors }: { colors: ColorAnalysis }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Average</h3>
        <div className="flex items-center gap-3">
          <ColorChip hex={colors.average.hex} />
          <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 text-sm">
            <dt>Hex</dt>
            <dd className="font-mono">{colors.average.hex}</dd>
            <dt>Mean lightness</dt>
            <dd>{colors.lightness}</dd>
            <dt>Mean chroma</dt>
            <dd>{colors.chroma}</dd>
          </dl>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Color buckets</h3>
        <BucketChart buckets={colors.buckets} />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Raw data</h3>
        <CodeBlock language="json" code={JSON.stringify(colors, null, 2)} />
      </section>
    </div>
  );
}

function BucketChart({ buckets }: { buckets: ColorAnalysis["buckets"] }) {
  // Scale to the largest bucket so small shares stay visible.
  const maxShare = Math.max(...buckets.map((b) => b.share), 0.01);
  return (
    <ul
      className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1"
      aria-label="Share of the photo per color bucket"
    >
      {buckets.map((bucket) => (
        <li key={bucket.name} className="flex flex-col items-center gap-1">
          <span className="text-muted-foreground text-[10px] tabular-nums">
            {formatShare(bucket.share)}
          </span>
          <div className="flex h-40 w-full items-end">
            <div
              className="w-full rounded-t-sm border"
              style={{ height: `${(bucket.share / maxShare) * 100}%`, backgroundColor: bucket.hex }}
            />
          </div>
          <span className="text-xs [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
            {bucket.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ColorChip({ hex }: { hex: string }) {
  return (
    <span
      aria-hidden
      className="size-10 shrink-0 rounded-md border"
      style={{ backgroundColor: hex }}
    />
  );
}

function formatShare(share: number): string {
  return share.toLocaleString(undefined, { style: "percent", maximumFractionDigits: 0 });
}
