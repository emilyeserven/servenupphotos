import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check } from "lucide-react";
import { type MapDownload, transitDownloadsQuery } from "@/api/transit";
import { Spinner } from "@/components/ui/spinner";
import {
  clockText,
  DOWNLOAD_STAGES,
  downloadDetail,
  downloadShare,
  downloadTitle,
  sourceText,
  stageState,
} from "@/lib/map-download";

/**
 * The rail and bus maps being downloaded or read while a look-up runs or after it failed (active),
 * each with its stages, what it's doing now, a progress bar and where the file comes from, so a
 * first look-up on a map shows what it's waiting for from the start. Nothing while none is.
 */
export function MapDownloads({ active, failure }: MapDownloadsProps) {
  const { data, error } = useQuery(transitDownloadsQuery(active));
  if (!active) return null;
  if (error) return <p className="text-destructive text-xs">{downloadsError(error)}</p>;
  return <DownloadList list={(data ?? []).filter((d) => concerns(d, failure))} />;
}

interface MapDownloadsProps {
  /** Whether a look-up is running or failed, so the maps it waits for are worth showing. */
  active: boolean;
  /** Why the look-up failed, if it did. */
  failure?: Error | null;
}

/**
 * Whether d is about this look-up: any map still loading is, but a failed one only when the
 * look-up failed naming it, so another map's failure, such as a different country's from a minute
 * ago, isn't shown under this one.
 */
function concerns(d: MapDownload, failure: Error | null | undefined): boolean {
  return d.step !== "failed" || Boolean(failure?.message.includes(d.map));
}

/** A card for each map in list; nothing while it's empty. */
function DownloadList({ list }: { list: MapDownload[] }) {
  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      {list.map((d) => (
        <MapDownloadRow key={d.map} download={d} />
      ))}
    </div>
  );
}

/** Why the page couldn't ask which maps are downloading, and what to do about it. */
function downloadsError(error: Error): string {
  return `Couldn't ask the backend which maps are downloading (${error.message}). If it was started before map downloads were added, restart it (pnpm dev:pipeline).`;
}

/** One map being loaded: what it's doing, how far it has got, and a bar; or why it failed. */
function MapDownloadRow({ download }: { download: MapDownload }) {
  const failed = download.step === "failed";
  return (
    <div className="bg-muted/40 flex flex-col gap-1.5 rounded-md border p-2 text-sm">
      <RowTitle download={download} failed={failed} />
      {download.url && <Stages download={download} />}
      {failed ? (
        <p className="text-destructive text-xs">{download.error}</p>
      ) : (
        <>
          <ProgressBar share={downloadShare(download)} label={downloadTitle(download)} />
          <p className="text-muted-foreground text-xs">{download.detail}</p>
        </>
      )}
      <p className="text-muted-foreground text-xs">{sourceLine(download)}</p>
    </div>
  );
}

/** The row's icon and title, and how far it has got on the right while it works. */
function RowTitle({ download, failed }: { download: MapDownload; failed: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <StepIcon failed={failed} />
      <span className="font-medium">{downloadTitle(download)}</span>
      {!failed && (
        <span className="text-muted-foreground ml-auto tabular-nums">
          {downloadDetail(download)}
        </span>
      )}
    </div>
  );
}

/** Where the file comes from and how long the load has taken in all. */
function sourceLine(d: MapDownload): string {
  const from = sourceText(d.url);
  const took =
    d.step === "failed"
      ? `Stopped after ${clockText(d.seconds)}`
      : `Started ${clockText(d.seconds)} ago`;
  return from ? `From ${from} · ${took}` : took;
}

/** A spinner while it works, or a warning once it failed. */
function StepIcon({ failed }: { failed: boolean }) {
  if (failed) return <AlertCircle aria-hidden className="text-destructive size-4 shrink-0" />;
  return <Spinner className="size-4 shrink-0" />;
}

/** The stages of a download in order, each done, running or still to come. */
function Stages({ download }: { download: MapDownload }) {
  return (
    <ol className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      {DOWNLOAD_STAGES.map(({ step, label }) => {
        const state = stageState(step, download.step);
        return (
          <li
            key={step}
            className={
              state === "now"
                ? "text-foreground flex items-center gap-1 font-medium"
                : "flex items-center gap-1"
            }
          >
            {state === "done" ? (
              <Check aria-hidden className="size-3" />
            ) : (
              <span className="size-3" />
            )}
            {label}
          </li>
        );
      })}
    </ol>
  );
}

/** A bar filled to share (0 to 1), or pulsing all the way across while that can't be told. */
function ProgressBar({ share, label }: { share?: number; label: string }) {
  const percent = share === undefined ? undefined : Math.round(share * 100);
  return (
    <div
      className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        className={
          percent === undefined
            ? "bg-primary/60 h-full w-full animate-pulse"
            : "bg-primary h-full transition-[width] duration-700"
        }
        style={percent === undefined ? undefined : { width: `${percent}%` }}
      />
    </div>
  );
}
