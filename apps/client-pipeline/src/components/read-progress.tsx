import { useQuery } from "@tanstack/react-query";
import { type ReadProgress, type ReadTask, readProgressQuery } from "@/api/data";
import { Spinner } from "@/components/ui/spinner";

/** What each task's read of the originals in R2 is reading. */
const R2_LABELS: Record<ReadTask, string> = {
  "missing-fields": "Reading camera details from the originals in R2",
  colors: "Reading each photo's colors from its original in R2",
};

interface ReadProgressViewProps {
  task: ReadTask;
  /** Shown until the backend says what it's reading, such as "Reading the photo JSON…". */
  label: string;
}

/**
 * What an Update Data read is doing while it runs, such as "Reading each photo's colors from its
 * original in R2: 42 of 150", with a bar once it can count.
 */
export function ReadProgressView({ task, label }: ReadProgressViewProps) {
  const { data } = useQuery(readProgressQuery(task));
  const progress = data?.running ? data : undefined;
  return (
    <div className="flex basis-full flex-col gap-2" aria-live="polite">
      <p className="flex items-center gap-2 text-sm">
        <Spinner />
        {progress ? stepLabel(task, progress) : label}
      </p>
      {progress && progress.total > 0 && (
        <ProgressBar done={progress.done} total={progress.total} />
      )}
    </div>
  );
}

/** The step the read is on, with how far it has got when it can count. */
function stepLabel(task: ReadTask, progress: ReadProgress): string {
  if (progress.step === "history") {
    return `Asking GitHub when the photo files were created: ${counted(progress)}`;
  }
  if (progress.step === "r2") return `${R2_LABELS[task]}: ${counted(progress)}`;
  return "Reading the photo files from GitHub…";
}

/** Such as "42 of 150". */
function counted({ done, total }: ReadProgress): string {
  return `${done} of ${total}`;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Read so far"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="bg-muted h-2 max-w-md overflow-hidden rounded-full"
    >
      <div
        className="bg-primary h-full transition-[width]"
        style={{ width: `${(done / total) * 100}%` }}
      />
    </div>
  );
}
