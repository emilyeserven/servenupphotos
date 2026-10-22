import { Link } from "@tanstack/react-router";
import { BulkQueue } from "@/components/bulk-upload/bulk-upload-panel";
import type { BulkPhoto, BulkStep } from "@/lib/bulk-upload";
import { useBulkUploadStore } from "@/stores/bulk-upload";

/** Where a photo has stopped, one way or another, so it no longer counts as uploading. */
const FINISHED: BulkStep[] = ["added", "skipped", "failed"];

function isFinished(photo: BulkPhoto): boolean {
  return FINISHED.includes(photo.step);
}

/** How far the upload queue is: how many of its photos are done, and whether any are still going. */
function useUploadProgress() {
  const photos = useBulkUploadStore((state) => state.photos);
  const done = photos.filter(isFinished).length;
  return { done, total: photos.length, active: done < photos.length };
}

/** A small ring filled as far as value (0 to 1) goes, in the current text color. */
function ProgressRing({ value }: { value: number }) {
  const radius = 6;
  const length = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        strokeWidth="2"
        className="stroke-current opacity-25"
      />
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - value)}
        className="stroke-current transition-[stroke-dashoffset]"
      />
    </svg>
  );
}

/**
 * The start of the sync button while photos are being uploaded: a ring of how many are done, and
 * the count. Nothing once the queue is done.
 */
export function UploadProgressBadge() {
  const { done, total, active } = useUploadProgress();
  if (!active) return null;
  return (
    <span
      className="text-foreground flex items-center gap-1.5 border-r pr-2 tabular-nums"
      aria-label={`Uploading: ${done} of ${total} photos done`}
    >
      <ProgressRing value={total ? done / total : 0} />
      {done}/{total}
    </span>
  );
}

/** The sync panel's look at the upload queue, while it has anything in it. */
export function UploadQueueSection({ onNavigate }: { onNavigate: () => void }) {
  const { total } = useUploadProgress();
  if (total === 0) return null;
  return (
    <section aria-label="Upload queue" className="flex flex-col gap-2 border-b pb-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Uploads</p>
        <Link
          to="/"
          onClick={onNavigate}
          className="text-muted-foreground underline underline-offset-4"
        >
          Status
        </Link>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <BulkQueue />
      </div>
    </section>
  );
}
