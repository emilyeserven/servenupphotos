import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { PhotoThumbnailButton } from "@/components/photo-thumbnail";
import { SeeMore } from "@/components/stat-row";
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

/**
 * The photos' count as a link opening them on the Grid with the filters that find them, reading
 * "See More (12) →" on hover, as the Numbers page's rows do.
 */
export function GridCount({
  search,
  count,
  label,
}: {
  search: Record<string, unknown>;
  count: number;
  label: string;
}) {
  return (
    <Link
      to="/grid"
      search={search}
      aria-label={`${label}: see its ${count} photos on the Grid`}
      className="group relative shrink-0 rounded-md px-2 py-1 text-sm text-muted-foreground tabular-nums outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SeeMore count={count} />
    </Link>
  );
}

/**
 * One group of the picked photos, such as the Autumn part of a stacked bar: a button with its color,
 * and name that opens and closes it, and its count, which opens the photos on the Grid, over its
 * thumbnails.
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
        </button>
        <GridCount search={search} count={group.photos.length} label={group.label} />
      </div>
      {open && (
        <div className="px-3 pt-1 pb-3">
          <PickedThumbnails photos={group.photos} onOpen={onOpen} />
        </div>
      )}
    </li>
  );
}
