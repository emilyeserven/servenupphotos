import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ImageIcon, PencilIcon } from "lucide-react";
import type { AllPhotosEntry, PhotoKind } from "@/components/all-photos/all-photos-files";
import { Button } from "@/components/ui/button";
import { squareImages } from "@/lib/offline-thumbnails";
import { cn } from "@/lib/utils";

/** The id of a photo's tile, which the jump box and `?photo=` scroll to. */
function tileId(path: string): string {
  return `all-photos-${path}`;
}

/** Scrolls the photo's tile to the middle of the window, when it's on the page. */
export function scrollToTile(path: string) {
  document.getElementById(tileId(path))?.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** How each kind of photo is marked on its tile and in the jump box. */
export const KIND_MARKS: Record<
  Exclude<PhotoKind, "published">,
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "bg-violet-600 text-white" },
  undecided: { label: "Undecided", className: "bg-amber-500 text-black" },
};

/** The photos as Square Thumbnail tiles, in the page's sort, with the one `highlight` names ringed. */
export function AllPhotosGrid({
  entries,
  highlight,
}: {
  entries: AllPhotosEntry[];
  highlight?: string;
}) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No photos to show.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
      {entries.map((entry) => (
        <li key={entry.path} id={tileId(entry.path)} className="scroll-mt-24">
          <PhotoTile entry={entry} highlighted={entry.path === highlight} />
        </li>
      ))}
    </ul>
  );
}

/** One photo: its Square Thumbnail with a Draft or Undecided mark, its name and date, and Edit. */
function PhotoTile({ entry, highlighted }: { entry: AllPhotosEntry; highlighted: boolean }) {
  return (
    <article
      className={cn(
        "bg-card flex h-full flex-col overflow-hidden rounded-xl border transition-shadow",
        entry.kind !== "published" && "border-dashed",
        highlighted && "ring-primary ring-offset-background ring-4 ring-offset-2",
      )}
    >
      <span className="bg-muted relative flex aspect-square items-center justify-center">
        <TileImage entry={entry} />
        <KindBadge kind={entry.kind} />
      </span>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h2 className="truncate text-sm font-medium" title={entry.name}>
          {entry.name}
        </h2>
        <p className="text-muted-foreground text-xs">{takenText(entry)}</p>
        <div className="mt-auto pt-1">
          <EditButton entry={entry} />
        </div>
      </div>
    </article>
  );
}

/** When the photo was taken, such as "Oct 3, 2025, 6:42 PM", or that it has no date. */
function takenText(entry: AllPhotosEntry): string {
  return entry.photo ? format(entry.photo.takenAt, "PP, p") : "No date taken";
}

/** The photo's Square Thumbnail from the offline copy, or an image icon without one; drafts dimmed a little. */
function TileImage({ entry }: { entry: AllPhotosEntry }) {
  const square = entry.imageUrl && squareImages(entry.data, entry.imageUrl);
  if (!square) return <ImageIcon className="text-muted-foreground size-6" aria-hidden />;
  return (
    <img
      src={square.square}
      alt=""
      loading="lazy"
      className={cn("size-full object-cover", entry.kind !== "published" && "opacity-75")}
    />
  );
}

/** "Draft" or "Undecided" over the tile's corner; nothing for a published photo. */
function KindBadge({ kind, className }: { kind: PhotoKind; className?: string }) {
  if (kind === "published") return null;
  const mark = KIND_MARKS[kind];
  return (
    <span
      className={cn(
        "absolute top-2 left-2 rounded px-1.5 py-0.5 text-[0.7rem] font-medium shadow-sm",
        mark.className,
        className,
      )}
    >
      {mark.label}
    </span>
  );
}

/** Opens the photo on the Photo page, as the Gallery does for one only on the base branch. */
function EditButton({ entry }: { entry: AllPhotosEntry }) {
  if (!entry.imageUrl) return <p className="text-muted-foreground text-xs">No image in R2</p>;
  const search = entry.onBase
    ? { edit: entry.path, from: "gallery" as const }
    : { edit: entry.path };
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/exif" search={search}>
        <PencilIcon />
        Edit
      </Link>
    </Button>
  );
}
