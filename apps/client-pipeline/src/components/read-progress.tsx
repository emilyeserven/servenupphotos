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
  return (
    <div className="flex basis-full flex-col gap-2" aria-live="polite">
      <p className="flex items-center gap-2 text-sm">
        <Spinner />
        {stepLabel(task, label, data)}
      </p>
      <ProgressBar progress={data} />
    </div>
  );
}

/** What each step says, given the task and how far it has got. */
const STEP_LABELS: Record<
  ReadProgress["step"],
  (task: ReadTask, progress: ReadProgress) => string
> = {
  "": () => "Reading the photo files…",
  github: () => "Reading the photo files from GitHub…",
  history: (_task, progress) =>
    `Asking GitHub when the photo files were created: ${counted(progress)}`,
  r2: (task, progress) => `${R2_LABELS[task]}: ${counted(progress)}`,
};

/** The step the read is on, with how far it has got when it can count, or `label` until it says. */
function stepLabel(task: ReadTask, label: string, progress: ReadProgress | undefined): string {
  if (!progress?.running) return label;
  return STEP_LABELS[progress.step](task, progress);
}

/** Such as "42 of 150". */
function counted({ done, total }: ReadProgress): string {
  return `${done} of ${total}`;
}

/** How far a counted step has got; nothing while no read is running or the step can't count. */
function ProgressBar({ progress }: { progress: ReadProgress | undefined }) {
  if (!progress?.running || progress.total === 0) return null;
  const { done, total } = progress;
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
