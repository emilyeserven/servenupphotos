import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { type MapDownload, transitDownloadsQuery } from "@/api/transit";
import { downloadDetail, downloadNote, downloadShare, downloadTitle } from "@/lib/map-download";

/**
 * The rail and bus maps being downloaded or read while a look-up runs (active), each with a
 * progress bar, so a first look-up on a map shows what it's waiting for from the start. Nothing
 * while none is.
 */
export function MapDownloads({ active }: { active: boolean }) {
  const { data } = useQuery(transitDownloadsQuery(active));
  if (!active || !data?.length) return null;
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      {data.map((d) => (
        <MapDownloadRow key={d.map} download={d} />
      ))}
    </div>
  );
}

/** One map being loaded: what it's doing, how far it has got, and a bar. */
function MapDownloadRow({ download }: { download: MapDownload }) {
  return (
    <div className="bg-muted/40 flex flex-col gap-1.5 rounded-md border p-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Download aria-hidden className="text-muted-foreground size-4 shrink-0" />
        <span className="font-medium">{downloadTitle(download)}</span>
        <span className="text-muted-foreground ml-auto tabular-nums">
          {downloadDetail(download)}
        </span>
      </div>
      <ProgressBar share={downloadShare(download)} label={downloadTitle(download)} />
      <p className="text-muted-foreground text-xs">{downloadNote(download.step)}</p>
    </div>
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
