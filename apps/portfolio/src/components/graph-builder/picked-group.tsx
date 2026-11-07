import { Link } from "@tanstack/react-router";
import { ChevronRight, Grid3x3 } from "lucide-react";
import { useState } from "react";
import { PhotoThumbnailButton } from "@/components/photo-thumbnail";
import type { PickedGroup } from "@/lib/graph-pick";
import type { Photo } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** How many of a group's photos show before its Show all button. */
const FIRST_SHOWN = 48;

/** The photos as square thumbnails, each opening it in the lightbox; the first 48 until Show all. */
export function PickedThumbnails({
  photos,
  onOpen,
}: {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? photos : photos.slice(0, FIRST_SHOWN);
  return (
    <div className="flex flex-col items-start gap-3">
      <ul className="grid w-full grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
        {shown.map((photo) => (
          <li key={photo.id}>
            <PhotoThumbnailButton
              image={photo.image}
              title={photo.title}
              onOpen={() => onOpen(photo)}
              className="aspect-square w-full"
            />
          </li>
        ))}
      </ul>
      {shown.length < photos.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Show all {photos.length.toLocaleString()}
        </button>
      )}
    </div>
  );
}

/** The link opening the photos on the Grid, with the filters that find them. */
export function GridLink({ search, label }: { search: Record<string, unknown>; label: string }) {
  return (
    <Link
      to="/grid"
      search={search}
      aria-label={`Open ${label} on the Grid`}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
    >
      <Grid3x3 aria-hidden />
      Open in Grid
    </Link>
  );
}

/**
 * One group of the picked photos, such as the Autumn part of a stacked bar: a button with its color,
 * name and count that opens and closes it, and Open in Grid, over its thumbnails.
 */
export function PickedGroupSection({
  group,
  search,
  open,
  onToggle,
  onOpen,
}: {
  group: PickedGroup;
  /** The Grid's filters for the group's photos. */
  search: Record<string, unknown>;
  open: boolean;
  onToggle: () => void;
  onOpen: (photo: Photo) => void;
}) {
  return (
    <li className="rounded-lg border">
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")}
            aria-hidden
          />
          <span
            className="size-2.5 shrink-0 rounded-[3px]"
            style={{ background: group.color }}
            aria-hidden
          />
          <span className="flex-1">{group.label}</span>
          <span className="text-muted-foreground tabular-nums">
            {group.photos.length.toLocaleString()}
          </span>
        </button>
        <GridLink search={search} label={group.label} />
      </div>
      {open && (
        <div className="px-3 pt-1 pb-3">
          <PickedThumbnails photos={group.photos} onOpen={onOpen} />
        </div>
      )}
    </li>
  );
}
