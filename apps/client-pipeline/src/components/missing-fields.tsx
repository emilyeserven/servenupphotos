import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  type AddedField,
  type MissingFieldsPreview,
  type MissingFieldsResult,
  addMissingFieldsMutation,
  missingFieldsQuery,
} from "@/api/data";
import { QueryResult } from "@/components/query-result";
import { ReadProgressView } from "@/components/read-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CommitSuccess,
  FileDetails,
  invalidatePhotoReads,
  OptionCheckbox,
  SaveButton,
  ScanPreviewBody,
  count,
} from "@/components/update-data-shared";

interface MissingFieldsCardProps {
  /** Whether R2 is set up, so missing EXIF fields can be read from the originals. */
  canReadExif: boolean;
}

/** Adds the fields new photo files have to older ones that are missing them. */
export function MissingFieldsCard({ canReadExif }: MissingFieldsCardProps) {
  const queryClient = useQueryClient();
  const [readExif, setReadExif] = useState(canReadExif);
  const [checked, setChecked] = useState<boolean | null>(null);
  const add = useMutation({
    ...addMissingFieldsMutation,
    onSuccess: () => {
      setChecked(null);
      invalidatePhotoReads(queryClient);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Missing fields</CardTitle>
        <CardDescription>
          Gives older photo files the fields new ones have, such as the title, place name, comment
          and camera settings. A missing field gets the value a new photo starts with, usually
          empty, except the Square Thumbnail&apos;s crop, which is read from the <code>?crop=</code>{" "}
          on its URL when it has one, and the photo&apos;s ID, the next number counting up in the
          order the files were created. Fields a file already has, even empty ones, aren&apos;t
          changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ExifOption
          checked={readExif}
          disabled={!canReadExif || add.isPending}
          onChange={(value) => {
            setReadExif(value);
            setChecked(null);
            add.reset();
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={add.isPending}
          onClick={() => {
            add.reset();
            setChecked(readExif);
          }}
        >
          Check photo files
        </Button>

        {checked !== null && (
          <MissingFieldsResultView
            readExif={checked}
            pending={add.isPending}
            error={add.error}
            onApply={() => add.mutate(checked)}
          />
        )}
        {add.isSuccess && <AddSuccess result={add.data} />}
      </CardContent>
    </Card>
  );
}

interface ExifOptionProps {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

function ExifOption(props: ExifOptionProps) {
  return (
    <OptionCheckbox
      label="Read missing camera details from the originals in R2"
      hint={
        props.disabled && !props.checked
          ? "Set up Cloudflare R2 in Settings to read them. Until then they're added empty."
          : "Fills a missing camera, lens, aperture, exposure, ISO, focal length, place, date or size from the photo's EXIF, and a missing Square Thumbnail crop from the one saved with the thumbnail. It downloads each of those photos, so it takes a little longer."
      }
      {...props}
    />
  );
}

interface ResultViewProps {
  readExif: boolean;
  pending: boolean;
  error: Error | null;
  onApply: () => void;
}

/** What adding the missing fields would do, with the button that does it. */
function MissingFieldsResultView({ readExif, ...apply }: ResultViewProps) {
  const preview = useQuery(missingFieldsQuery(readExif));
  return (
    <section aria-label="Preview" className="flex flex-col gap-4 border-t pt-6">
      <QueryResult
        query={preview}
        pending={<ReadProgressView task="missing-fields" label="Reading the photo JSON…" />}
      >
        {(data) => <PreviewBody preview={data} {...apply} />}
      </QueryResult>
    </section>
  );
}

type PreviewBodyProps = Omit<ResultViewProps, "readExif"> & { preview: MissingFieldsPreview };

function PreviewBody({ preview, ...apply }: PreviewBodyProps) {
  return (
    <ScanPreviewBody
      scan={preview}
      changed={preview.files.length}
      nothing="have every field, so there's nothing to add"
      headline={`${preview.files.length === 1 ? "is" : "are"} missing fields`}
    >
      <FieldCounts fields={preview.fields} />
      <FilesMissingFields files={preview.files} />
      <ApplyButton preview={preview} {...apply} />
    </ScanPreviewBody>
  );
}

/** How many files miss each field, and how many of those get it from EXIF. */
function FieldCounts({ fields }: { fields: MissingFieldsPreview["fields"] }) {
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {fields.map((f) => (
        <li key={f.field} className="bg-muted rounded-md px-2 py-1">
          <code>{f.field}</code> <span className="text-muted-foreground">{fieldCountText(f)}</span>
        </li>
      ))}
    </ul>
  );
}

/** How many files miss a field, and where their values come from, such as "3 files, 2 from EXIF". */
function fieldCountText(f: MissingFieldsPreview["fields"][number]): string {
  const sources = [
    [f.fromExif, "from EXIF"],
    [f.fromThumbnail, "from the Square Thumbnail"],
    [f.numbered, "numbered in the order they were created"],
    [f.fromHistory, "dated by their first commit"],
  ] as const;
  return [
    count(f.files, "file"),
    ...sources.flatMap(([n, from]) => (n > 0 ? [`${n} ${from}`] : [])),
  ].join(", ");
}

/** What a field's value is, beside it, when it isn't the field's default. */
function addedSource(a: AddedField): string | null {
  return ADDED_SOURCES.find(([key]) => a[key])?.[1] ?? null;
}

/** Each way a field's value can come from somewhere other than its default, and how it's named. */
const ADDED_SOURCES: [Exclude<keyof AddedField, "field" | "value">, string][] = [
  ["fromExif", "from EXIF"],
  ["fromThumbnail", "from the Square Thumbnail"],
  ["fromHistory", "when the file was first committed"],
  ["numbered", "the next ID, by when the file was created"],
];

/** Each file missing fields, collapsed to its name and count, with the values it gets inside. */
function FilesMissingFields({ files }: { files: MissingFieldsPreview["files"] }) {
  return (
    <ul className="flex flex-col divide-y rounded-md border text-sm">
      {files.map((file) => (
        <FileDetails key={file.path} path={file.path} note={count(file.added.length, "field")}>
          <div className="flex flex-col gap-2 px-3 pt-1 pb-3">
            {file.exifError && (
              <p className="text-destructive">
                Couldn&apos;t read its EXIF, so those fields are added empty: {file.exifError}
              </p>
            )}
            {file.cropError && (
              <p className="text-destructive">
                Couldn&apos;t read its Square Thumbnail&apos;s crop, so it&apos;s added empty:{" "}
                {file.cropError}
              </p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {file.added.map((a) => (
                <div key={a.field} className="contents">
                  <dt className="font-medium">{a.field}</dt>
                  <dd className="text-xs">
                    <span className="font-mono break-all">{JSON.stringify(a.value)}</span>
                    <AddedSource field={a} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </FileDetails>
      ))}
    </ul>
  );
}

/** Where an added value came from, after it, when it isn't the field's default. */
function AddedSource({ field }: { field: AddedField }) {
  const source = addedSource(field);
  if (!source) return null;
  return <span className="text-muted-foreground whitespace-nowrap"> {source}</span>;
}

/** The button that adds the fields, held back while a photo file can't be read. */
function ApplyButton({ preview, pending, error, onApply }: PreviewBodyProps) {
  const fields = preview.files.reduce((sum, f) => sum + f.added.length, 0);
  return (
    <SaveButton
      label={`Add ${count(fields, "field")} to ${count(preview.files.length, "file")}`}
      disabled={preview.unreadable.length > 0}
      pending={pending}
      error={error}
      onClick={onApply}
    >
      {pending && <ReadProgressView task="missing-fields" label="Reading the photo JSON…" />}
    </SaveButton>
  );
}

function AddSuccess({ result }: { result: MissingFieldsResult }) {
  return (
    <CommitSuccess result={result}>
      Added {count(result.fields, "field")} to {count(result.files, "file")}
    </CommitSuccess>
  );
}
