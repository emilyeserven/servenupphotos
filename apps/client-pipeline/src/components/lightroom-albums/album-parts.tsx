import { HardDriveDownloadIcon, TriangleAlertIcon } from "lucide-react";
import { count } from "@/components/update-data-shared";
import { cn } from "@/lib/utils";
import { LIGHTROOM_STAGES, type LightroomAlbum, type LightroomStage } from "@/lib/lightroom-albums";
import { useLightroomAlbumsStore } from "@/stores/lightroom-albums";

interface AlbumTitleProps {
  album: LightroomAlbum;
  className?: string;
  /** Leaves out the Offline mark, where every album shown is offline anyway. */
  hideOffline?: boolean;
}

/** The album's name with its Smart, Offline and photo count marks, and a warning when the LLM wasn't sure of it. */
export function AlbumTitle({ album, className, hideOffline = false }: AlbumTitleProps) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium", className)}>
      {album.name}
      <KindMark album={album} />
      {album.offline && !hideOffline && <OfflineBadge />}
      <PhotoCount photoCount={album.photoCount} />
      <Uncertain note={album.uncertainNote} />
    </p>
  );
}

/** Says the album is a Smart Collection, or was added by hand rather than read from Lightroom. */
function KindMark({ album }: { album: LightroomAlbum }) {
  const mark = album.smart ? "Smart" : album.manual ? "Added by hand" : "";
  return mark && <span className="text-muted-foreground text-xs">{mark}</span>;
}

/** How many photos Lightroom says the album has, when it showed a count. */
function PhotoCount({ photoCount }: { photoCount: number | null }) {
  if (photoCount === null) return null;
  return <span className="text-muted-foreground text-xs">{count(photoCount, "photo")}</span>;
}

/** Marks an album Lightroom keeps on the device, so it can be worked on without the internet. */
function OfflineBadge() {
  return (
    <span
      title="Available offline in Lightroom"
      className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-normal text-sky-800 dark:bg-sky-950 dark:text-sky-200"
    >
      <HardDriveDownloadIcon className="size-3" aria-hidden />
      Offline
    </span>
  );
}

/** A warning icon saying why the LLM wasn't sure it read the name right. */
export function Uncertain({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <span className="flex items-center gap-1 text-xs font-normal text-amber-600 dark:text-amber-400">
      <TriangleAlertIcon className="size-3.5" aria-hidden />
      {note}
    </span>
  );
}

/** Picks the album's stage, or none. */
export function StageSelect({ album, className }: { album: LightroomAlbum; className?: string }) {
  const setAlbum = useLightroomAlbumsStore((state) => state.setAlbum);
  return (
    <select
      aria-label={`Stage of ${album.name}`}
      className={cn("border-input bg-background h-9 rounded-md border px-3 text-sm", className)}
      value={album.stage ?? ""}
      onChange={(event) =>
        setAlbum(album.path, { stage: (event.target.value || null) as LightroomStage | null })
      }
    >
      <option value="">No stage</option>
      {LIGHTROOM_STAGES.map((stage) => (
        <option key={stage} value={stage}>
          {stage}
        </option>
      ))}
    </select>
  );
}
