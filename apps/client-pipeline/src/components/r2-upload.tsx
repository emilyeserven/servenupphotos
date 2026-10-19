import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, CopyIcon, ImageOffIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { missingSettings } from "@/api/connections";
import type { BucketImage } from "@/api/photos";
import { settingsQuery } from "@/api/settings";
import { PUBLISHED } from "@/api/versions";
import {
  type CloudflareResponse,
  type UploadMutation,
  type UploadRequest,
  type UploadResponse,
  UploadError,
  renamePhoto,
} from "@/api/upload";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { Crop } from "@/lib/crop";

interface R2UploadProps {
  photo: File;
  /** Owned by the page, which puts the uploaded photo's URL into the sanitized EXIF. */
  upload: UploadMutation;
  /** The square the thumbnail is cut from, once the crop card has picked one. */
  crop: Crop | null;
}

/** Uploads an analyzed photo to the R2 bucket, once R2 is set up in Settings. */
export function R2Upload({ photo, upload, crop }: R2UploadProps) {
  const settings = useQuery(settingsQuery);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload to R2</CardTitle>
        <CardDescription>
          Puts the original photo, its resized WEBP versions and its Square Thumbnail in your bucket
          and gives you their links.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryResult query={settings} pendingLabel="Checking R2 settings…">
          {(data) => {
            const missing = missingSettings("r2", data);
            if (missing.length > 0) return <R2NotSetUp missing={missing} />;
            return <UploadForm photo={photo} upload={upload} crop={crop} />;
          }}
        </QueryResult>
      </CardContent>
    </Card>
  );
}

function R2NotSetUp({ missing }: { missing: string[] }) {
  return (
    <p className="text-muted-foreground text-sm">
      R2 isn't set up yet: add the {missing.join(", ")} in{" "}
      <Link to="/settings" className="text-foreground underline underline-offset-4">
        Settings
      </Link>
      .
    </p>
  );
}

function UploadForm({ photo, upload, crop }: R2UploadProps) {
  if (upload.isSuccess) return <Uploaded result={upload.data} />;
  // Retries send what was last tried, so a new name sticks, with the crop as it is now.
  const request: UploadRequest = upload.variables ?? { photo };
  const send = (next: UploadRequest) => upload.mutate(crop ? { ...next, crop } : next);
  const sameName = sameNameError(upload.error);
  if (sameName) {
    return <SameNamePrompt error={sameName} photo={request.photo} onUpload={send} />;
  }
  return (
    <div className="flex flex-col gap-2">
      <UploadButton pending={upload.isPending} onClick={() => send(request)} />
      <UploadFailure error={upload.error} />
    </div>
  );
}

/** error when it stopped the upload because the bucket has a photo with the same name. */
function sameNameError(error: Error | null): UploadError | undefined {
  if (error instanceof UploadError && error.sameName.length > 0) return error;
  return undefined;
}

/** Why the upload failed, with what Cloudflare actually answered when it rejected it. */
function UploadFailure({ error }: { error: Error | null }) {
  if (!error) return null;
  const cloudflare = error instanceof UploadError ? error.cloudflare : undefined;
  return (
    <>
      <p className="text-destructive text-sm">{error.message}</p>
      {cloudflare && <CloudflareDetails response={cloudflare} />}
    </>
  );
}

/** Cloudflare's answer, for looking up a failure its plain-language reason doesn't explain. */
function CloudflareDetails({ response }: { response: CloudflareResponse }) {
  const rows = [
    ["Status", response.status],
    ["Code", response.code],
    ["Message", response.message],
    ["Request ID", response.requestId],
  ].filter(([, value]) => value);
  return (
    <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3 text-xs">
      <p className="font-medium">Cloudflare's response</p>
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {rows.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-mono">{value}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      <pre className="text-muted-foreground font-mono break-all whitespace-pre-wrap">
        {response.error}
      </pre>
    </div>
  );
}

interface SameNamePromptProps {
  error: UploadError;
  photo: File;
  onUpload: (request: UploadRequest) => void;
}

/** A photo with the same name is already in the bucket: shows it, and offers to rename this one or keep the name. */
function SameNamePrompt({ error, photo, onUpload }: SameNamePromptProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-medium">{error.message}</p>
        <p className="text-muted-foreground">
          Photos in Flight finds photos by name, so two photos named {photo.name} can show the wrong
          one. Rename this photo before uploading it?
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {error.sameName.map((image) => (
          <li key={image.key}>
            <ExistingPhoto image={image} />
          </li>
        ))}
      </ul>
      <RenameForm photo={photo} onUpload={onUpload} />
    </div>
  );
}

function RenameForm({ photo, onUpload }: Omit<SameNamePromptProps, "error">) {
  const form = useForm({
    defaultValues: { name: `${photo.name.replace(/\.[^.]*$/, "")}-2` },
    onSubmit: ({ value }) => onUpload({ photo: renamePhoto(photo, value.name) }),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void form.handleSubmit();
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <form.Field name="name" validators={{ onChange: ({ value }) => validateName(value) }}>
        {(field) => (
          <RenameField
            value={field.state.value}
            error={field.state.meta.errors[0]}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
          />
        )}
      </form.Field>
      <div className="flex flex-wrap gap-2">
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button type="submit" disabled={!canSubmit}>
              Rename and upload
            </Button>
          )}
        </form.Subscribe>
        <Button
          type="button"
          variant="outline"
          onClick={() => onUpload({ photo, keepSameName: true })}
        >
          Keep {photo.name}
        </Button>
      </div>
    </form>
  );
}

interface RenameFieldProps {
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function RenameField({ value, error, onChange, onBlur }: RenameFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="r2-upload-name" className="text-sm font-medium">
        New name
      </label>
      <div className="flex items-center gap-2">
        <Input
          id="r2-upload-name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error !== undefined}
          aria-describedby={error ? "r2-upload-name-error" : undefined}
        />
        <span className="text-muted-foreground text-sm">.jpg</span>
      </div>
      {error && (
        <p id="r2-upload-name-error" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** Why name can't be used for an upload, or undefined if it can. Keys keep only letters and numbers. */
function validateName(name: string): string | undefined {
  if (!/[a-z0-9]/i.test(name)) return "Use at least one letter or number.";
  return undefined;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** A photo already in the bucket, linking to its public URL, with its key and upload time. */
function ExistingPhoto({ image }: { image: BucketImage }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="flex flex-col gap-1.5">
      <a href={image.url} target="_blank" rel="noreferrer">
        {failed ? (
          <div className="bg-muted/40 text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm">
            <ImageOffIcon className="size-6" aria-hidden />
            Couldn't load
          </div>
        ) : (
          <img
            src={image.url}
            alt={`Already in the bucket: ${image.key}`}
            onError={() => setFailed(true)}
            className="bg-muted aspect-square w-full rounded-lg border object-cover"
          />
        )}
      </a>
      <figcaption className="flex flex-col text-xs">
        <span className="truncate font-mono" title={image.key}>
          {image.key}
        </span>
        <span className="text-muted-foreground">
          Uploaded {dateFormat.format(new Date(image.modified))}
        </span>
      </figcaption>
    </figure>
  );
}

function UploadButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <Button className="self-start" disabled={pending} onClick={onClick}>
      {pending && <Spinner />}
      {pending ? "Uploading…" : "Upload to R2"}
    </Button>
  );
}

function Uploaded({ result }: { result: UploadResponse }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          readOnly
          value={result.url}
          aria-label="Photo URL"
          onFocus={(e) => e.target.select()}
        />
        <CopyButton text={result.url} />
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {PUBLISHED.map((version) => (
          <li key={version.name} className="flex gap-2">
            <span className="text-muted-foreground w-32 shrink-0">{version.label}</span>
            <a
              href={result.versions[version.name].url}
              target="_blank"
              rel="noreferrer"
              className="truncate font-mono text-xs leading-5 underline underline-offset-4"
            >
              {result.versions[version.name].key}
            </a>
          </li>
        ))}
      </ul>
      {imageFailed ? (
        <p className="text-muted-foreground text-sm">
          The photo was uploaded, but it didn't load from this URL. Check that the public URL in
          Settings matches the bucket's public access domain.
        </p>
      ) : (
        <img
          src={result.url}
          alt="The uploaded photo, loaded from R2"
          className="max-h-80 w-full rounded-lg border object-contain"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
