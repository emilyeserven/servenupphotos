import {
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import type { FieldChange } from "@/api/cameras";
import type { ScannedPhotos } from "@/api/data";
import type { PendingSave } from "@/api/scan-changes";
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

/** One file a field change previews, with the top-level fields it rewrites. */
interface ChangedFile {
  path: string;
  changes: FieldChange[];
}

/** A preview of rewriting some top-level fields across the files. */
interface FieldChangesPreview extends ScannedPhotos {
  files: ChangedFile[];
}

/** What a field change saved, waiting for Commit. */
interface FieldChangesResult extends PendingSave {
  files: number;
  fields: number;
}

/** An Update Data card that previews rewriting some top-level fields across the files, then applies it. */
export interface FieldChangesCardProps<P extends FieldChangesPreview> {
  title: string;
  description: ReactNode;
  preview: UseQueryOptions<P, Error, P, string[]>;
  apply: UseMutationOptions<FieldChangesResult, Error, void>;
  /** What the preview says when no file changes, such as that they all have the overrides. */
  renderUnchanged: (preview: P) => ReactNode;
  /** The files read, such as "12 photo files", for "3 of 12 photo files change". */
  total: (preview: P) => string;
  /** What's beside a changed file's name, such as its camera. */
  note: (file: P["files"][number]) => string;
  /** Other reads to refresh after applying, besides the photo files'. */
  refresh?: QueryKey[];
}

/** Checks the files, lists the fields that would change in each, and applies them. */
export function FieldChangesCard<P extends FieldChangesPreview>(props: FieldChangesCardProps<P>) {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const apply = useMutation({
    ...props.apply,
    onSuccess: () => {
      setChecking(false);
      invalidatePhotoReads(queryClient);
      for (const queryKey of props.refresh ?? []) void queryClient.invalidateQueries({ queryKey });
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
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
          Check files
        </Button>
        {checking && (
          <PreviewView
            card={props}
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

interface PreviewProps<P extends FieldChangesPreview> extends ApplyProps {
  card: FieldChangesCardProps<P>;
}

function PreviewView<P extends FieldChangesPreview>(props: PreviewProps<P>) {
  const preview = useQuery(props.card.preview);
  return (
    <section aria-label="Preview" className="flex flex-col gap-4 border-t pt-6">
      <QueryResult query={preview} pendingLabel="Reading the files…">
        {(data) => <PreviewBody preview={data} {...props} />}
      </QueryResult>
    </section>
  );
}

function PreviewBody<P extends FieldChangesPreview>({
  preview,
  card,
  ...apply
}: PreviewProps<P> & { preview: P }) {
  if (preview.files.length === 0) {
    return (
      <>
        <p className="text-sm">{card.renderUnchanged(preview)}</p>
        <Unreadable files={preview.unreadable} />
      </>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-1 text-sm">
        <p>
          <strong>
            {preview.files.length} of {card.total(preview)}
          </strong>{" "}
          change.
        </p>
        <p className="text-muted-foreground">
          <PreviewDestination scan={preview} />
        </p>
      </div>
      <Unreadable files={preview.unreadable} blocking />
      <ul className="flex flex-col divide-y rounded-md border text-sm">
        {preview.files.map((file) => (
          <FileDetails key={file.path} path={file.path} note={card.note(file)}>
            <FieldChangeList changes={file.changes} />
          </FileDetails>
        ))}
      </ul>
      <ApplyButton
        files={preview.files.length}
        blocked={preview.unreadable.length > 0}
        {...apply}
      />
    </>
  );
}

/** Each field's old and new value. */
function FieldChangeList({ changes }: { changes: FieldChange[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-3 pt-1 pb-3">
      {changes.map((c) => (
        <div key={c.field} className="contents">
          <dt className="font-medium">{c.field}</dt>
          <dd className="font-mono text-xs break-all">
            {JSON.stringify(c.from)} → {JSON.stringify(c.to)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ApplyButton({
  files,
  blocked,
  pending,
  error,
  onApply,
}: ApplyProps & { files: number; blocked: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" disabled={blocked || pending} onClick={onApply}>
        {pending ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          `Apply to ${count(files, "file")}`
        )}
      </Button>
      {error && <p className="text-destructive text-sm">{error.message}</p>}
    </div>
  );
}

function ApplySuccess({ result }: { result: FieldChangesResult }) {
  return (
    <CommitSuccess result={result}>
      Changed {count(result.fields, "field")} in {count(result.files, "file")}
    </CommitSuccess>
  );
}
