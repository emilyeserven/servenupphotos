import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  CopyIcon,
  PencilIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useObjectUrl } from "@/hooks/use-object-url";
import { BULK_STEPS, type BulkPhoto, type BulkStep } from "@/lib/bulk-upload";
import { useBulkUploadStore } from "@/stores/bulk-upload";

/** What each step in progress says it's doing. */
const WORKING: Partial<Record<BulkStep, string>> = {
  analyzing: "Reading its EXIF and colors…",
  checking: "Looking for it in the saved photo data…",
  uploading: "Uploading to R2 and making its sizes…",
  saving: "Adding it to the batch…",
};

const LINK = "underline underline-offset-4";

/** Which of the four steps a photo in progress is on, counting from 1. */
function stepNumber(step: BulkStep): number {
  return BULK_STEPS.findIndex((each) => each.step === step) + 1;
}

/** One photo in Bulk Upload's queue: a thumbnail, where it is, and what can be done about it. */
export function BulkPhotoRow({ photo }: { photo: BulkPhoto }) {
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 py-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]">
      <Thumbnail file={photo.file} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-sm font-medium" title={photo.file.name}>
          {photo.file.name}
        </p>
        <Status photo={photo} />
        {photo.warning && photo.step === "added" && (
          <Line icon={<TriangleAlertIcon />} className="text-amber-700 dark:text-amber-400">
            {photo.warning}
          </Line>
        )}
      </div>
      {/* Under the text on a phone, so it keeps the row's width. */}
      <div className="col-start-2 empty:hidden sm:col-start-3">
        <Actions photo={photo} />
      </div>
    </li>
  );
}

function Thumbnail({ file }: { file: File }) {
  const [url, setFile] = useObjectUrl();
  useEffect(() => setFile(file), [file, setFile]);
  return (
    <div className="bg-muted size-14 shrink-0 overflow-hidden rounded-md border">
      {url && (
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      )}
    </div>
  );
}

function Line({
  icon,
  className,
  children,
}: {
  icon: ReactNode;
  className: string;
  children: ReactNode;
}) {
  return (
    <p
      className={`flex items-start gap-1.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 ${className}`}
    >
      {icon}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function Status({ photo }: { photo: BulkPhoto }) {
  const working = WORKING[photo.step];
  if (working) {
    return (
      <Line icon={<Spinner />} className="text-muted-foreground">
        Step {stepNumber(photo.step)} of {BULK_STEPS.length}: {working}
      </Line>
    );
  }
  return <Finished photo={photo} />;
}

function Finished({ photo }: { photo: BulkPhoto }) {
  if (photo.step === "added") return <Added photo={photo} />;
  if (photo.step === "skipped") return <Skipped photo={photo} />;
  if (photo.step === "failed") return <Failed photo={photo} />;
  return (
    <Line icon={<ClockIcon />} className="text-muted-foreground">
      Waiting
    </Line>
  );
}

function Added({ photo }: { photo: BulkPhoto }) {
  const saved = photo.saved;
  return (
    <Line icon={<CircleCheckIcon />} className="text-emerald-700 dark:text-emerald-400">
      Added to the batch as{" "}
      <a href={saved?.fileUrl} target="_blank" rel="noreferrer" className={LINK}>
        {saved?.path.split("/").pop()}
      </a>
    </Line>
  );
}

function Skipped({ photo }: { photo: BulkPhoto }) {
  const match = photo.matches?.[0];
  return (
    <Line icon={<CopyIcon />} className="text-amber-700 dark:text-amber-400">
      {photo.error}{" "}
      {match?.fileUrl && (
        <a href={match.fileUrl} target="_blank" rel="noreferrer" className={LINK}>
          See it
        </a>
      )}
    </Line>
  );
}

function Failed({ photo }: { photo: BulkPhoto }) {
  const other = photo.sameName?.[0];
  return (
    <>
      <Line icon={<CircleAlertIcon />} className="text-destructive">
        {photo.error}
      </Line>
      {other && (
        <p className="text-muted-foreground text-sm">
          R2 already has{" "}
          <a href={other.url} target="_blank" rel="noreferrer" className={LINK}>
            a different photo under this name
          </a>
          . Keep the name to upload it anyway, or rename the file and add it again.
        </p>
      )}
    </>
  );
}

function EditButton({ photo }: { photo: BulkPhoto }) {
  if (!photo.saved) return null;
  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/exif" search={{ edit: photo.saved.path }}>
        <PencilIcon aria-hidden />
        Edit
      </Link>
    </Button>
  );
}

/** Edit, and hiding the photo from the list once you're done with it; it stays in the batch. */
function AddedActions({ photo }: { photo: BulkPhoto }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <EditButton photo={photo} />
      <RemoveButton photo={photo} label={`Hide ${photo.file.name} from the list`} />
    </div>
  );
}

function hasSameName(photo: BulkPhoto): boolean {
  return (photo.sameName?.length ?? 0) > 0;
}

function FailedActions({ photo }: { photo: BulkPhoto }) {
  const queryClient = useQueryClient();
  const retry = useBulkUploadStore((state) => state.retry);
  const sameName = hasSameName(photo);
  return (
    <div className="flex shrink-0 items-center gap-1">
      {photo.retryable && (
        <Button variant="outline" size="sm" onClick={() => retry(photo.id, queryClient, sameName)}>
          {sameName ? "Keep name" : "Retry"}
        </Button>
      )}
      <RemoveButton photo={photo} />
    </div>
  );
}

/** Takes the photo off the list; label says so for screen readers, "Take … off the list" unless given. */
function RemoveButton({ photo, label }: { photo: BulkPhoto; label?: string }) {
  const remove = useBulkUploadStore((state) => state.remove);
  const text = label ?? `Take ${photo.file.name} off the list`;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={text}
      title={text}
      onClick={() => remove(photo.id)}
    >
      <XIcon aria-hidden />
    </Button>
  );
}

/**
 * What can be done with the photo where it is: edit it once added, retry a failure, or take it off
 * the list. Nothing while it's being worked on.
 */
const ACTIONS: Partial<Record<BulkStep, (props: { photo: BulkPhoto }) => ReactNode>> = {
  added: AddedActions,
  failed: FailedActions,
  waiting: RemoveButton,
  skipped: RemoveButton,
};

function Actions({ photo }: { photo: BulkPhoto }) {
  const Action = ACTIONS[photo.step];
  return Action ? <Action photo={photo} /> : null;
}
