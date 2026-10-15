import { type UseMutationResult, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { missingSettings } from "@/api/connections";
import { settingsQuery } from "@/api/settings";
import type { UploadResponse } from "@/api/upload";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type UploadMutation = UseMutationResult<UploadResponse, Error, File>;

interface R2UploadProps {
  photo: File;
  /** Owned by the page, which puts the uploaded photo's URL into the sanitized EXIF. */
  upload: UploadMutation;
}

/** Uploads an analyzed photo to the R2 bucket, once R2 is set up in Settings. */
export function R2Upload({ photo, upload }: R2UploadProps) {
  const settings = useQuery(settingsQuery);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload to R2</CardTitle>
        <CardDescription>
          Puts the original photo in your bucket and gives you its link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryResult query={settings} pendingLabel="Checking R2 settings…">
          {(data) => {
            const missing = missingSettings("r2", data);
            if (missing.length > 0) return <R2NotSetUp missing={missing} />;
            return <UploadForm photo={photo} upload={upload} />;
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

function UploadForm({ photo, upload }: R2UploadProps) {
  if (upload.isSuccess) return <Uploaded result={upload.data} />;
  return (
    <div className="flex flex-col gap-2">
      <UploadButton pending={upload.isPending} onClick={() => upload.mutate(photo)} />
      {upload.error && <p className="text-destructive text-sm">{upload.error.message}</p>}
    </div>
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
