import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  type ReapplyPreview,
  type ReapplyResult,
  reapplyMutation,
  reapplyPreviewQuery,
} from "@/api/cameras";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  CommitSuccess,
  FileDetails,
  invalidatePhotoReads,
  PreviewDestination,
  Unreadable,
  count,
} from "@/components/update-data-shared";

/** Applies the camera overrides again to every photo file, after they've changed. */
export function ReapplyOverridesCard() {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const apply = useMutation({
    ...reapplyMutation,
    onSuccess: () => {
      setChecking(false);
      invalidatePhotoReads(queryClient);
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Camera overrides</CardTitle>
        <CardDescription>
          Applies the{" "}
          <Link to="/camera-overrides" className="text-foreground underline underline-offset-4">
            camera overrides
          </Link>{" "}
          to every photo file again, starting from each photo&apos;s EXIF values: its own, or the
          ones its <code>exifOriginals</code> kept when an override changed them. A field no
          override sets any more goes back to its EXIF value. New photos get the overrides when
          their EXIF is read.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={apply.isPending}
          onClick={() => {
            apply.reset();
            setChecking(true);
          }}
        >
          Check photo files
        </Button>
        {checking && (
          <ReapplyPreviewView
            pending={apply.isPending}
            error={apply.error}
            onApply={() => apply.mutate()}
          />
        )}
        {apply.isSuccess && <ApplySuccess result={apply.data} />}
      </CardContent>
    </Card>
  );
}

interface ApplyProps {
  pending: boolean;
  error: Error | null;
  onApply: () => void;
}

function ReapplyPreviewView(apply: ApplyProps) {
  const preview = useQuery(reapplyPreviewQuery);
  return (
    <section aria-label="Preview" className="flex flex-col gap-4 border-t pt-6">
      <QueryResult query={preview} pendingLabel="Reading the photo JSON…">
        {(data) => <PreviewBody preview={data} {...apply} />}
      </QueryResult>
    </section>
  );
}

function PreviewBody({ preview, ...apply }: ApplyProps & { preview: ReapplyPreview }) {
  if (preview.files.length === 0) {
    return (
      <>
        <p className="text-sm">
          All {count(preview.photoFiles, "photo file")} on <code>{preview.branch}</code> already
          have the {count(preview.overrides, "camera override")}, so there&apos;s nothing to change.
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
          change.
        </p>
        <p className="text-muted-foreground">
          <PreviewDestination scan={preview} />
        </p>
      </div>
      <Unreadable files={preview.unreadable} blocking />
      <ChangedFiles files={preview.files} />
      <ApplyButton preview={preview} {...apply} />
    </>
  );
}

/** Each file that changes, collapsed to its name and camera, with its fields' old and new values inside. */
function ChangedFiles({ files }: { files: ReapplyPreview["files"] }) {
  return (
    <ul className="flex flex-col divide-y rounded-md border text-sm">
      {files.map((file) => (
        <FileDetails
          key={file.path}
          path={file.path}
          note={`${file.camera}, ${count(file.changes.length, "field")}`}
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-3 pt-1 pb-3">
            {file.changes.map((c) => (
              <div key={c.field} className="contents">
                <dt className="font-medium">{c.field}</dt>
                <dd className="font-mono text-xs break-all">
                  {JSON.stringify(c.from)} → {JSON.stringify(c.to)}
                </dd>
              </div>
            ))}
          </dl>
        </FileDetails>
      ))}
    </ul>
  );
}

function ApplyButton({
  preview,
  pending,
  error,
  onApply,
}: ApplyProps & { preview: ReapplyPreview }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" disabled={preview.unreadable.length > 0 || pending} onClick={onApply}>
        {pending ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          `Apply to ${count(preview.files.length, "file")}`
        )}
      </Button>
      {error && <p className="text-destructive text-sm">{error.message}</p>}
    </div>
  );
}

function ApplySuccess({ result }: { result: ReapplyResult }) {
  return (
    <CommitSuccess result={result}>
      Changed {count(result.fields, "field")} in {count(result.files, "file")}
    </CommitSuccess>
  );
}
