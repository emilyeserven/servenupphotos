import { Link } from "@tanstack/react-router";
import { CheckIcon, CopyIcon, ImageOffIcon } from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import type { BucketImage } from "@/api/photos";
import { PUBLISHED } from "@/api/versions";
import {
  type CloudflareResponse,
  type UploadRequest,
  type UploadResponse,
  UploadError,
  renamePhoto,
} from "@/api/upload";
import { type R2Upload, sameNameError } from "@/components/r2-upload/use-r2-upload";
import { RenameForm } from "@/components/rename-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { uploadNameProblem } from "@/lib/file-name";

interface R2DetailsProps {
  r2: R2Upload;
  photo: File;
  /** The R2 settings still missing, which stop any upload. */
  missing: string[];
}

/** What the R2 button does and did: the upload's links, or why it can't upload or failed. */
export function R2Details({ r2, photo, missing }: R2DetailsProps) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="font-medium">Upload to R2</p>
        <p className="text-muted-foreground">
          Puts the original photo, its resized WEBP versions and its Square Thumbnail in your bucket
          and gives you their links. Moving the square afterwards remakes the Square Thumbnail.
        </p>
      </div>
      <R2DetailsBody r2={r2} photo={photo} missing={missing} />
    </>
  );
}

function R2DetailsBody({ r2, photo, missing }: R2DetailsProps) {
  if (missing.length > 0) return <R2NotSetUp missing={missing} />;
  if (r2.uploaded) return <Uploaded r2={r2} result={r2.uploaded} />;
  return <NotUploaded r2={r2} photo={photo} />;
}

/** The upload under way, why it failed, or a prompt for a new name. */
function NotUploaded({ r2, photo }: Omit<R2DetailsProps, "missing">) {
  const sameName = sameNameError(r2.upload.error);
  if (sameName) {
    const request = r2.upload.variables ?? { photo };
    return <SameNamePrompt error={sameName} photo={request.photo} onUpload={r2.send} />;
  }
  if (r2.upload.isPending) return <Pending>Uploading the photo and its versions…</Pending>;
  return <UploadFailure error={r2.upload.error} />;
}

function Pending({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground flex items-center gap-2">
      <Spinner />
      {children}
    </p>
  );
}

function R2NotSetUp({ missing }: { missing: string[] }) {
  return (
    <p className="text-muted-foreground">
      R2 isn't set up yet: add the {missing.join(", ")} in{" "}
      <Link to="/settings" className="text-foreground underline underline-offset-4">
        Settings
      </Link>
      .
    </p>
  );
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
      <RenameForm
        id="r2-upload-name"
        suggested={suggestedUploadName(error, photo)}
        extension=".jpg"
        submitLabel="Rename and upload"
        validate={uploadNameProblem}
        onRename={(name) => onUpload({ photo: renamePhoto(photo, name) })}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onUpload({ photo, keepSameName: true })}
        >
          Keep {photo.name}
        </Button>
      </RenameForm>
    </div>
  );
}

/** The name to try instead: the backend's free one, or this one with "-2" added. */
function suggestedUploadName(error: UploadError, photo: File): string {
  return error.suggestedName ?? `${photo.name.replace(/\.[^.]*$/, "")}-2`;
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
            loading="lazy"
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

function Uploaded({ r2, result }: { r2: R2Upload; result: UploadResponse }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <RemakeStatus r2={r2} />
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
          className="max-h-48 w-full rounded-lg border object-contain"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}

/** Whether the square has moved since the Square Thumbnail was cut, or is being remade, or failed to be. */
function RemakeStatus({ r2 }: { r2: R2Upload }) {
  const { remake } = r2;
  if (remake.isPending) return <Pending>Remaking the Square Thumbnail…</Pending>;
  if (remake.isError) return <p className="text-destructive">{remake.error.message}</p>;
  if (r2.action !== "remake") return null;
  return (
    <p className="text-amber-700 dark:text-amber-400">
      The square has moved since the Square Thumbnail was cut. Remake thumbnail cuts it and its
      Thumbnail Preview again from the new square, over the ones in R2.
    </p>
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
