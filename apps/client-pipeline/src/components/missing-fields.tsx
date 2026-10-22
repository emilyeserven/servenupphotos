import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import {
  type MissingFieldsPreview,
  type MissingFieldsResult,
  addMissingFieldsMutation,
  missingFieldsQuery,
} from "@/api/data";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  CommitSuccess,
  PreviewDestination,
  Unreadable,
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
      // The photo JSON changed, so every preview and in-flight read is stale.
      void queryClient.invalidateQueries({ queryKey: ["data"] });
      void queryClient.invalidateQueries({ queryKey: ["photos"] });
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
          on its URL when it has one. Fields a file already has, even empty ones, aren&apos;t
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

function ExifOption({ checked, disabled, onChange }: ExifOptionProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 text-sm">
      <input
        id={id}
        type="checkbox"
        className="accent-primary mt-0.5 size-4"
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="font-medium">
          Read missing camera details from the originals in R2
        </label>
        <p id={`${id}-hint`} className="text-muted-foreground">
          {disabled && !checked
            ? "Set up Cloudflare R2 in Settings to read them. Until then they're added empty."
            : "Fills a missing camera, lens, aperture, exposure, ISO, focal length, place, date or size from the photo's EXIF, and a missing Square Thumbnail crop from the one saved with the thumbnail. It downloads each of those photos, so it takes a little longer."}
        </p>
      </div>
    </div>
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
        pendingLabel={readExif ? "Reading the photo JSON and EXIF…" : "Reading the photo JSON…"}
      >
        {(data) => <PreviewBody preview={data} {...apply} />}
      </QueryResult>
    </section>
  );
}

type PreviewBodyProps = Omit<ResultViewProps, "readExif"> & { preview: MissingFieldsPreview };

function PreviewBody({ preview, ...apply }: PreviewBodyProps) {
  if (preview.files.length === 0) {
    return (
      <>
        <p className="text-sm">
          All {count(preview.photoFiles, "photo file")} on <code>{preview.branch}</code> have every
          field, so there&apos;s nothing to add.
        </p>
        <Unreadable files={preview.unreadable} />
      </>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-1 text-sm">
        <p>
          <strong>
            {preview.files.length} of {count(preview.photoFiles, "photo file")}
          </strong>{" "}
          {preview.files.length === 1 ? "is" : "are"} missing fields.
        </p>
        <p className="text-muted-foreground">
          <PreviewDestination scan={preview} />
        </p>
      </div>
      <FieldCounts fields={preview.fields} />
      <Unreadable files={preview.unreadable} blocking />
      <FilesMissingFields files={preview.files} />
      <ApplyButton preview={preview} {...apply} />
    </>
  );
}

/** How many files miss each field, and how many of those get it from EXIF. */
function FieldCounts({ fields }: { fields: MissingFieldsPreview["fields"] }) {
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {fields.map((f) => (
        <li key={f.field} className="bg-muted rounded-md px-2 py-1">
          <code>{f.field}</code>{" "}
          <span className="text-muted-foreground">
            {count(f.files, "file")}
            {f.fromExif > 0 && `, ${f.fromExif} from EXIF`}
            {f.fromThumbnail > 0 && `, ${f.fromThumbnail} from the Square Thumbnail`}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Each file missing fields, collapsed to its name and count, with the values it gets inside. */
function FilesMissingFields({ files }: { files: MissingFieldsPreview["files"] }) {
  return (
    <ul className="flex flex-col divide-y rounded-md border text-sm">
      {files.map((file) => (
        <li key={file.path}>
          <details>
            <summary className="hover:bg-muted/50 flex cursor-pointer items-center justify-between gap-3 px-3 py-2">
              <code className="min-w-0 truncate">{file.path.split("/").pop()}</code>
              <span className="text-muted-foreground shrink-0">
                {count(file.added.length, "field")}
              </span>
            </summary>
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
                      {a.fromExif && (
                        <span className="text-muted-foreground whitespace-nowrap"> from EXIF</span>
                      )}
                      {a.fromThumbnail && (
                        <span className="text-muted-foreground whitespace-nowrap">
                          {" "}
                          from the Square Thumbnail
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

/** The button that adds the fields, held back while a photo file can't be read. */
function ApplyButton({ preview, pending, error, onApply }: PreviewBodyProps) {
  const fields = preview.files.reduce((sum, f) => sum + f.added.length, 0);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" disabled={preview.unreadable.length > 0 || pending} onClick={onApply}>
        {pending ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          `Add ${count(fields, "field")} to ${count(preview.files.length, "file")}`
        )}
      </Button>
      {error && <p className="text-destructive text-sm">{error.message}</p>}
    </div>
  );
}

function AddSuccess({ result }: { result: MissingFieldsResult }) {
  return (
    <CommitSuccess result={result}>
      Added {count(result.fields, "field")} to {count(result.files, "file")}
    </CommitSuccess>
  );
}
