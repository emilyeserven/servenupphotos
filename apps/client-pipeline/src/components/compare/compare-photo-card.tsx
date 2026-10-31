import { Link } from "@tanstack/react-router";
import { ImageOffIcon, PencilIcon, TrophyIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { DraftMark } from "@/components/draft-mark";
import { FallbackImage } from "@/components/fallback-image";
import { ImageLightbox } from "@/components/image-lightbox";
import { Button } from "@/components/ui/button";
import { useCompareEdits } from "@/hooks/use-compare-groups";
import { type ComparePhoto, comparePhotoName, isWinner } from "@/lib/compare-groups";
import { offlineSmallUrl } from "@/lib/offline-thumbnails";
import { SETTING_FORMATS } from "@portfolio/lib/photos";
import { readableDate } from "@/lib/photo-date";
import { cn } from "@/lib/utils";

/** One photo of a compare group: large, with what it was taken with, and Pick as winner. */
export function ComparePhotoCard({ photo }: { photo: ComparePhoto }) {
  const winner = isWinner(photo);
  return (
    <article
      className={cn(
        "bg-card flex h-full flex-col overflow-hidden rounded-xl border",
        winner && "border-amber-500 ring-2 ring-amber-500",
      )}
    >
      <CompareImage photo={photo} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <PhotoHeading photo={photo} winner={winner} />
        <PhotoDetails data={photo.data} />
        <div className="mt-auto flex flex-wrap gap-2">
          <WinnerButton photo={photo} winner={winner} />
          <EditButton photo={photo} />
          <TakeOut photo={photo} />
        </div>
      </div>
    </article>
  );
}

/** The image the photo's JSON saves as `images.medium`, or else its image in R2. */
function mediumUrl(photo: ComparePhoto): string | undefined {
  const medium = (photo.data.images as Record<string, unknown> | undefined)?.medium;
  return typeof medium === "string" && medium ? medium : photo.imageUrl;
}

/**
 * The photo at its Medium size, fitted into the same box for every photo of the group so they line
 * up, opening full size; the offline copy's Small version when it can't be loaded.
 */
function CompareImage({ photo }: { photo: ComparePhoto }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = mediumUrl(photo);
  const name = comparePhotoName(photo);
  if (!src || failed) return <NoImage />;
  return (
    <>
      <button
        type="button"
        title="Show it full size"
        onClick={() => setOpen(true)}
        className="focus-visible:ring-ring bg-muted aspect-[4/3] w-full cursor-zoom-in border-b outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <FallbackImage
          src={src}
          fallback={offlineSmallUrl(src)}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-contain"
        />
      </button>
      <ImageLightbox
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        src={photo.imageUrl ?? src}
        description={`${name} at full size.`}
      />
    </>
  );
}

function NoImage() {
  return (
    <div className="bg-muted/40 text-muted-foreground flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 border-b text-xs">
      <ImageOffIcon className="size-6" aria-hidden />
      No image in R2
    </div>
  );
}

/** The photo's name and file, where it is (on the portfolio or in flight), and the winner mark. */
function PhotoHeading({ photo, winner }: { photo: ComparePhoto; winner: boolean }) {
  const name = comparePhotoName(photo);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {winner && (
        <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
          <TrophyIcon className="size-3.5" aria-hidden />
          Winner
        </span>
      )}
      <h2 className="truncate font-medium" title={name}>
        {name}
      </h2>
      <p className="text-muted-foreground truncate font-mono text-xs">
        {photo.file.path.split("/").pop()}
      </p>
      <p className="text-muted-foreground text-xs">
        {photo.fromGallery ? "In the Gallery" : "In flight"}
      </p>
      <DraftMark data={photo.data} />
    </div>
  );
}

/** A field of the photo's data as text, when it's a string or number. */
function text(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

/** The photo's exposure settings on one line, such as "f/5.6 · 1/450s · ISO 125 · 18mm", written as the portfolio writes them. */
function settingsLine(data: Record<string, unknown>): string | undefined {
  const parts = SETTING_FORMATS.flatMap(([key, format]) => {
    const value = text(data, key);
    return value ? [format(value)] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** When it was taken: the custom date, or else the EXIF one. */
function takenText(data: Record<string, unknown>): string | undefined {
  const date = text(data, "customCreateDate") ?? text(data, "createDate");
  return date && readableDate(date);
}

/** The photo's size in pixels, such as "6779 × 3813". */
function sizeText(data: Record<string, unknown>): string | undefined {
  const width = text(data, "width");
  const height = text(data, "height");
  return width && height ? `${width} × ${height}` : undefined;
}

/** When, with what and how the photo was taken, as its JSON has it, so the photos can be weighed. */
function PhotoDetails({ data }: { data: Record<string, unknown> }) {
  const rows = [
    ["Taken", takenText(data)],
    ["Camera", text(data, "camera")],
    ["Lens", text(data, "customLens") ?? text(data, "lens")],
    ["Settings", settingsLine(data)],
    ["Size", sizeText(data)],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="truncate" title={value}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Picks the photo as one of the group's winners, or unpicks it when it is one. */
function WinnerButton({ photo, winner }: { photo: ComparePhoto; winner: boolean }) {
  const { setWinner } = useCompareEdits();
  return (
    <Button
      size="sm"
      variant={winner ? "default" : "outline"}
      aria-pressed={winner}
      title={winner ? "Unpick it" : "Pick it to post; a group can have several winners"}
      onClick={() => setWinner(photo, !winner)}
    >
      <TrophyIcon />
      {winner ? "Winner" : "Pick as winner"}
    </Button>
  );
}

/** Opens the photo on the Photo page, to name or fix it; nothing without an image in R2. */
function EditButton({ photo }: { photo: ComparePhoto }) {
  if (!photo.imageUrl) return null;
  const search = photo.fromGallery
    ? { edit: photo.file.path, from: "gallery" as const }
    : { edit: photo.file.path };
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/exif" search={search}>
        <PencilIcon />
        Edit
      </Link>
    </Button>
  );
}

/** Takes the photo out of the group, leaving it as it was. */
function TakeOut({ photo }: { photo: ComparePhoto }) {
  const { setGroup } = useCompareEdits();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      onClick={() => setGroup([photo.file], null)}
    >
      <XIcon />
      Take out
    </Button>
  );
}
